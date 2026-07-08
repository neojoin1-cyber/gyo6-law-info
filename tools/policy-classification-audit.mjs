import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const args = new Set(process.argv.slice(2));
const shouldWrite = args.has("--write");
const roleCodes = [
  "student",
  "parent",
  "teacher",
  "fixedTermTeacher",
  "privateSchool",
  "localOfficer",
  "educationWorker",
  "manager"
];
const staffIdentityRoles = ["fixedTermTeacher", "privateSchool", "localOfficer", "educationWorker"];
const studentOnlyCategories = [
  "studentAttendance",
  "fieldExperienceLearning",
  "studentRecords",
  "schoolViolenceGuide",
  "studentLifeGuidance",
  "studentWelfare",
  "studentHealthCounseling",
  "studentSafety",
  "vocationalFieldTraining",
  "careerEmployment",
  "admissionsPathways",
  "vocationalCurriculum"
];
const studentOnlyTopicMajors = [
  "studentPathway",
  "studentSupport",
  "vocationalLearning",
  "employment",
  "fieldTraining",
  "schoolViolence"
];

const context = loadAppContext();
const failures = [];
const warnings = [];
const roleCategoryReport = {};
const topicMajorReport = {};

for (const role of roleCodes) {
  const categories = context.getRequiredPolicyCategoryOptionsForRole(role).map((option) => option.value).filter(Boolean);
  roleCategoryReport[role] = categories;

  for (const category of categories) {
    if (!context.isPolicyCategoryCompatibleWithRole(role, category)) {
      failures.push(`${role}: category ${category} is visible but incompatible`);
    }
  }

  if (staffIdentityRoles.includes(role)) {
    for (const category of studentOnlyCategories) {
      if (categories.includes(category)) {
        failures.push(`${role}: staff identity role must not expose student-only category ${category}`);
      }
    }
  }
}

for (const role of roleCodes) {
  const majors = context.getTopicMajorOptionsForRole(role).map((option) => option.value).filter(Boolean);
  topicMajorReport[role] = majors;

  for (const major of majors) {
    if (!context.isTopicMajorCompatibleWithRole(role, major)) {
      failures.push(`${role}: topic major ${major} is visible but incompatible`);
    }
  }

  if (staffIdentityRoles.includes(role)) {
    for (const major of studentOnlyTopicMajors) {
      if (majors.includes(major)) {
        failures.push(`${role}: staff identity role must not expose student-only topic major ${major}`);
      }
    }
  }
}

const coercionChecks = [
  ["privateSchool", "studentAttendance", "leaveAttendance"],
  ["fixedTermTeacher", "fieldExperienceLearning", "leaveAttendance"],
  ["educationWorker", "studentRecords", "leaveAttendance"],
  ["localOfficer", "studentAttendance", "leaveAttendance"]
];

for (const [role, category, expected] of coercionChecks) {
  const actual = context.coercePolicyCategoryForRole(role, category);
  if (actual !== expected) {
    failures.push(`${role} + ${category}: expected coercion to ${expected}, got ${actual}`);
  }
}

if (!context.isPolicyCategoryCompatibleWithRole("student", "studentAttendance")) {
  failures.push("student + studentAttendance should be compatible");
}

if (!context.isPolicyCategoryCompatibleWithRole("teacher", "studentLifeGuidance")) {
  warnings.push("teacher + studentLifeGuidance should remain available for classroom authority questions");
}

const detailRequirementChecks = [
  ["leaveAttendance", "휴가 규정은?", true],
  ["leaveAttendance", "병가 서류는?", false],
  ["studentAttendance", "출결 기준은?", true],
  ["studentAttendance", "학생 부모상 출석인정결석은?", false],
  ["budgetExecution", "학교회계는 어떻게 처리하나요?", true],
  ["budgetExecution", "강사수당 지출 증빙은?", false]
];

for (const [category, question, shouldRequire] of detailRequirementChecks) {
  const requirement = context.getPolicyCategoryDetailRequirement(category, question, {
    major: "auto",
    middle: "auto",
    minor: "auto"
  });
  if (Boolean(requirement) !== shouldRequire) {
    failures.push(`${category}: detail requirement mismatch for "${question}"`);
  }
}

const semanticRoutingChecks = [
  {
    id: "staff-private-attendance-term",
    question: "사립학교 교직원 출결 인정결석 기준은?",
    expectedDomain: "staffAttendanceService",
    expectedCategory: "leaveAttendance",
    mustInclude: ["교직원에게는", "복무"],
    mustNotInclude: ["학생부·출결·정정 사안", "학교생활기록부 기재요령을 기준"]
  },
  {
    id: "education-worker-attendance-term",
    question: "교육공무직 출결 인정결석은 어떻게 처리하나요?",
    expectedDomain: "staffAttendanceService",
    expectedCategory: "leaveAttendance",
    mustInclude: ["교직원에게는", "복무"],
    mustNotInclude: ["학생부·출결·정정 사안", "학교생활기록부 기재요령을 기준"]
  },
  {
    id: "student-parent-death-attendance",
    question: "학생의 부모 사망시 휴가는?",
    expectedDomain: "studentRecordsAttendance",
    expectedCategory: "studentRecords",
    mustInclude: ["출석인정결석", "5일"],
    mustNotInclude: ["공립 교원", "나이스 근무상황"]
  }
];

for (const check of semanticRoutingChecks) {
  const response = context.GYO6_POLICY_ENGINE.buildPolicyResponse({
    question: check.question,
    officeLabel: "경상북도교육청"
  });
  const text = [
    response.title,
    response.lead,
    ...(response.answer || []),
    response.caution
  ].filter(Boolean).join(" ");
  if (response.domain !== check.expectedDomain) {
    failures.push(`${check.id}: expected domain ${check.expectedDomain}, got ${response.domain || "none"}`);
  }
  if (response.categoryCode !== check.expectedCategory) {
    failures.push(`${check.id}: expected category ${check.expectedCategory}, got ${response.categoryCode || "none"}`);
  }
  for (const phrase of check.mustInclude || []) {
    if (!text.includes(phrase)) failures.push(`${check.id}: expected phrase "${phrase}"`);
  }
  for (const phrase of check.mustNotInclude || []) {
    if (text.includes(phrase)) failures.push(`${check.id}: forbidden phrase "${phrase}"`);
  }
}

const payload = {
  ok: failures.length === 0,
  checkedAt: new Date().toISOString(),
  roleCount: roleCodes.length,
  roleCategoryReport,
  topicMajorReport,
  detailRequirementChecks: detailRequirementChecks.length,
  semanticRoutingChecks: semanticRoutingChecks.length,
  failures,
  warnings
};

if (shouldWrite) {
  const outDir = path.join(rootDir, "data", "policy-quality");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "classification-audit.json"), `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

if (!payload.ok) {
  console.error(`Policy classification audit failed: ${failures.length}`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Policy classification audit passed: ${roleCodes.length} roles, ${Object.values(roleCategoryReport).flat().length} role-category options, ${Object.values(topicMajorReport).flat().length} topic-major options`);

function loadAppContext() {
  const stubElement = createStubElement();
  const sandbox = {
    console,
    Blob: class {},
    URLSearchParams,
    URL: {
      createObjectURL() { return ""; },
      revokeObjectURL() {}
    },
    document: {
      body: stubElement,
      createElement() { return createStubElement(); },
      querySelector() { return createStubElement(); },
      querySelectorAll() { return []; }
    },
    localStorage: {
      getItem() { return null; },
      setItem() {},
      removeItem() {}
    },
    window: {
      addEventListener() {},
      setTimeout() {},
      clearTimeout() {},
      open() { return null; },
      print() {},
      confirm() { return true; },
      location: { hash: "", search: "" }
    }
  };

  vm.createContext(sandbox);
  for (const file of [
    "public/policy-knowledge-base.js",
    "public/policy-source-registry.js",
    "public/policy-corpus.js",
    "public/policy-question-taxonomy.js",
    "public/policy-engine.js",
    "public/app.js"
  ]) {
    vm.runInContext(fs.readFileSync(path.join(rootDir, file), "utf8"), sandbox, { filename: file });
  }

  for (const helperName of [
    "getRequiredPolicyCategoryOptionsForRole",
    "getTopicMajorOptionsForRole",
    "isPolicyCategoryCompatibleWithRole",
    "isTopicMajorCompatibleWithRole",
    "coercePolicyCategoryForRole",
    "getPolicyCategoryDetailRequirement"
  ]) {
    if (typeof sandbox[helperName] !== "function") {
      throw new Error(`missing_helper:${helperName}`);
    }
  }

  return sandbox;
}

function createStubElement() {
  const classes = new Set();
  return {
    addEventListener() {},
    appendChild() {},
    remove() {},
    requestSubmit() {},
    setAttribute(name, value) { this.attributes[name] = String(value); },
    getAttribute(name) { return this.attributes[name] ?? null; },
    querySelector() { return createStubElement(); },
    querySelectorAll() { return []; },
    classList: {
      add(className) { classes.add(className); },
      remove(className) { classes.delete(className); },
      toggle(className, force) {
        const shouldAdd = force === undefined ? !classes.has(className) : Boolean(force);
        if (shouldAdd) classes.add(className);
        else classes.delete(className);
        return shouldAdd;
      },
      contains(className) { return classes.has(className); }
    },
    style: {},
    dataset: {},
    attributes: {},
    hidden: false,
    value: "",
    innerHTML: "",
    textContent: "",
    firstElementChild: null,
    options: []
  };
}
