import assert from "node:assert/strict";

import worker from "../workers/ai-analysis/src/index.js";


class MockStatement {
  constructor(db, sql) {
    this.db = db;
    this.sql = sql.replace(/\s+/g, " ").trim();
    this.params = [];
  }

  bind(...params) {
    this.params = params;
    return this;
  }

  async run() {
    if (this.sql.startsWith("INSERT INTO business_card_contacts")) {
      this.db.contacts.push({ id: this.db.contacts.length + 1, params: this.params });
      return { meta: { last_row_id: this.db.contacts.length } };
    }
    return { meta: {} };
  }

  async first() {
    if (this.sql.includes("COUNT(*) AS count") && this.sql.includes("business_card_contacts")) {
      return { count: this.db.recentCount };
    }
    return null;
  }

  async all() {
    return { results: [] };
  }
}

class MockD1 {
  constructor() {
    this.contacts = [];
    this.recentCount = 0;
  }

  prepare(sql) {
    return new MockStatement(this, sql);
  }
}

const env = {
  MEMBER_DB: new MockD1(),
  ALLOWED_ORIGINS: "https://gyo6.kr",
  CARD_EXCHANGE_HASH_SALT: "test-only-salt"
};

async function exchange(body) {
  const request = new Request("https://gyo6-law-info-ai.test/api/card/exchange", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "https://gyo6.kr",
      "cf-connecting-ip": "203.0.113.10"
    },
    body: JSON.stringify(body)
  });
  const response = await worker.fetch(request, env);
  return { response, data: await response.json() };
}

const validPayload = {
  cardSlug: "kim-younghee",
  name: "홍길동",
  phone: "010-1234-5678",
  email: "hong@example.com",
  organization: "경주고등학교",
  title: "교사",
  note: "교육지원 협력 논의",
  source: "vocational",
  mode: "vocational",
  consent: true
};

{
  const { response, data } = await exchange(validPayload);
  assert.equal(response.status, 200);
  assert.equal(data.ok, true);
  assert.equal(env.MEMBER_DB.contacts.length, 1);
}

{
  const { response, data } = await exchange({ ...validPayload, phone: "", email: "" });
  assert.equal(response.status, 400);
  assert.equal(data.code, "CARD_CONTACT_REQUIRED");
}

{
  const { response, data } = await exchange({ ...validPayload, email: "잘못된주소" });
  assert.equal(response.status, 400);
  assert.equal(data.code, "CARD_EMAIL_INVALID");
}

{
  const { response, data } = await exchange({ ...validPayload, consent: false });
  assert.equal(response.status, 400);
  assert.equal(data.code, "CARD_CONSENT_REQUIRED");
}

{
  const before = env.MEMBER_DB.contacts.length;
  const { response, data } = await exchange({ ...validPayload, website: "https://spam.example" });
  assert.equal(response.status, 200);
  assert.equal(data.accepted, true);
  assert.equal(env.MEMBER_DB.contacts.length, before);
}

{
  env.MEMBER_DB.recentCount = 8;
  const { response, data } = await exchange(validPayload);
  assert.equal(response.status, 429);
  assert.equal(data.code, "CARD_EXCHANGE_RATE_LIMIT");
}

console.log("business-card-regression: ok");
