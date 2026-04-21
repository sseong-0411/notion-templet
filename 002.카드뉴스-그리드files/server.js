/**
 * Notion Gallery Widget - Backend Proxy Server
 *
 * 역할:
 * 1. Notion API 토큰을 서버 측에 은닉 (브라우저 노출 방지)
 * 2. DB 페이지 목록 + 각 페이지 본문의 이미지 블록을 일괄 조회
 * 3. 프론트엔드에 정제된 JSON 제공
 *
 * 주의:
 * - 노션 호스팅 이미지 URL은 약 1시간 후 만료됨 (signed URL)
 * - 프론트엔드에서 주기적 새로고침 또는 재호출 필요
 */

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { Client } = require("@notionhq/client");
const path = require("path");

// ─── 환경변수 검증 ───────────────────────────────────
const REQUIRED_ENV = ["NOTION_TOKEN", "NOTION_DATABASE_ID"];
for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    console.error("[ERROR] 환경변수 누락: " + key);
    console.error(".env 파일을 .env.example 기반으로 생성하세요.");
    process.exit(1);
  }
}

const PORT = parseInt(process.env.PORT, 10) || 3000;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "*";
const DATABASE_ID = process.env.NOTION_DATABASE_ID;

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const app = express();

// ─── CORS ────────────────────────────────────────────
app.use(
  cors({
    origin: ALLOWED_ORIGIN === "*" ? true : ALLOWED_ORIGIN.split(","),
  })
);

// ─── 정적 파일 제공 (프론트엔드) ────────────────────────
app.use(express.static(path.join(__dirname, "public")));

// ─── 유틸: 페이지 본문에서 이미지 URL 추출 ──────────────
async function extractImagesFromPage(pageId) {
  const images = [];
  let cursor = undefined;
  let hasMore = true;

  try {
    while (hasMore) {
      const response = await notion.blocks.children.list({
        block_id: pageId,
        start_cursor: cursor,
        page_size: 100,
      });

      for (const block of response.results) {
        if (block.type === "image") {
          const img = block.image;
          let url = null;
          let expiry = null;

          if (img.type === "file") {
            // 노션 호스팅 (signed URL, ~1시간 만료)
            url = img.file.url;
            expiry = img.file.expiry_time || null;
          } else if (img.type === "external") {
            // 외부 URL (만료 없음)
            url = img.external.url;
          }

          if (url) {
            images.push({
              url: url,
              expiry: expiry,
              caption:
                img.caption && img.caption.length > 0
                  ? img.caption.map(function (c) { return c.plain_text; }).join("")
                  : null,
            });
          }
        }
      }

      hasMore = response.has_more;
      cursor = response.next_cursor;
    }
  } catch (err) {
    console.error(
      "[WARN] 이미지 블록 조회 실패 (pageId: " + pageId + "):",
      err.message
    );
  }

  return images;
}

// ─── 유틸: 노션 속성값 → 단순 값 변환 ───────────────────
function extractProperty(prop) {
  if (!prop) return null;

  switch (prop.type) {
    case "title":
      return prop.title.map(function (t) { return t.plain_text; }).join("");
    case "rich_text":
      return prop.rich_text.map(function (t) { return t.plain_text; }).join("");
    case "select":
      return prop.select ? prop.select.name : null;
    case "multi_select":
      return prop.multi_select.map(function (s) { return s.name; });
    case "url":
      return prop.url;
    case "number":
      return prop.number;
    case "date":
      return prop.date
        ? {
            start: prop.date.start,
            end: prop.date.end,
          }
        : null;
    case "checkbox":
      return prop.checkbox;
    case "rollup":
      if (prop.rollup && prop.rollup.type === "number") {
        return prop.rollup.number;
      }
      return null;
    default:
      return null;
  }
}

// ─── API: 게시물 목록 (이미지 포함) ─────────────────────
app.get("/api/posts", async function (req, res) {
  try {
    // 1) DB 쿼리 - 게시 예정일 기준 내림차순
    var allPages = [];
    var cursor = undefined;
    var hasMore = true;

    while (hasMore) {
      var queryParams = {
        database_id: DATABASE_ID,
        page_size: 100,
        sorts: [
          {
            property: "게시 예정일",
            direction: "descending",
          },
        ],
      };

      if (cursor) {
        queryParams.start_cursor = cursor;
      }

      // 선택적 필터: ?status=게시완료
      var statusFilter = req.query.status;
      if (statusFilter) {
        queryParams.filter = {
          property: "게시 상태",
          select: {
            equals: statusFilter,
          },
        };
      }

      var dbResponse = await notion.databases.query(queryParams);
      allPages = allPages.concat(dbResponse.results);
      hasMore = dbResponse.has_more;
      cursor = dbResponse.next_cursor;
    }

    // 2) 각 페이지의 속성 + 본문 이미지 추출
    var posts = await Promise.all(
      allPages.map(async function (page) {
        var props = page.properties;
        var images = await extractImagesFromPage(page.id);

        return {
          id: page.id,
          title: extractProperty(props["게시물 제목"]),
          status: extractProperty(props["게시 상태"]),
          postType: extractProperty(props["게시 유형"]),
          scheduledDate: extractProperty(props["게시 예정일"]),
          figmaUrl: extractProperty(props["피그마 링크"]),
          caption: extractProperty(props["캡션"]),
          hashtags: extractProperty(props["해시태그"]),
          memo: extractProperty(props["메모"]),
          order: extractProperty(props["순서"]),
          images: images,
          notionUrl: page.url,
          cover: page.cover
            ? page.cover.type === "file"
              ? page.cover.file.url
              : page.cover.external
              ? page.cover.external.url
              : null
            : null,
        };
      })
    );

    res.json({
      success: true,
      count: posts.length,
      posts: posts,
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[ERROR] /api/posts:", err.message);

    var statusCode = 500;
    var message = "서버 내부 오류";

    if (err.code === "unauthorized") {
      statusCode = 401;
      message =
        "Notion API 인증 실패. Integration Token과 DB 공유 설정을 확인하세요.";
    } else if (err.code === "object_not_found") {
      statusCode = 404;
      message =
        "데이터베이스를 찾을 수 없습니다. DB ID와 Integration 연결을 확인하세요.";
    }

    res.status(statusCode).json({
      success: false,
      error: message,
    });
  }
});

// ─── API: 단일 게시물 상세 ──────────────────────────────
app.get("/api/posts/:pageId", async function (req, res) {
  var pageId = req.params.pageId;

  // UUID 형식 기본 검증
  if (!/^[a-f0-9-]{32,36}$/i.test(pageId)) {
    return res.status(400).json({
      success: false,
      error: "유효하지 않은 페이지 ID 형식입니다.",
    });
  }

  try {
    var page = await notion.pages.retrieve({ page_id: pageId });
    var images = await extractImagesFromPage(pageId);
    var props = page.properties;

    res.json({
      success: true,
      post: {
        id: page.id,
        title: extractProperty(props["게시물 제목"]),
        status: extractProperty(props["게시 상태"]),
        postType: extractProperty(props["게시 유형"]),
        scheduledDate: extractProperty(props["게시 예정일"]),
        figmaUrl: extractProperty(props["피그마 링크"]),
        caption: extractProperty(props["캡션"]),
        hashtags: extractProperty(props["해시태그"]),
        memo: extractProperty(props["메모"]),
        images: images,
        notionUrl: page.url,
      },
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[ERROR] /api/posts/" + pageId + ":", err.message);
    res.status(err.status || 500).json({
      success: false,
      error: err.message,
    });
  }
});

// ─── 서버 시작 ──────────────────────────────────────────
app.listen(PORT, function () {
  console.log("");
  console.log("=== Notion Gallery Widget Server ===");
  console.log("포트: " + PORT);
  console.log("DB ID: " + DATABASE_ID.substring(0, 8) + "...");
  console.log("갤러리: http://localhost:" + PORT);
  console.log("API:    http://localhost:" + PORT + "/api/posts");
  console.log("====================================");
  console.log("");
});
