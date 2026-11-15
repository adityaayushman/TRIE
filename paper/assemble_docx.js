const fs = require("fs");
const { Document, Packer, Paragraph, TextRun, AlignmentType } = require("docx");
const content = require("./build_docx.js");

const doc = new Document({
  styles: {
    default: {
      document: { run: { font: content.FONT, size: content.BODY_SIZE } },
      heading1: { run: { font: content.FONT, bold: true, size: 24 }, paragraph: { spacing: { before: 240, after: 120 }, keepNext: true } },
      heading2: { run: { font: content.FONT, bold: true, italics: true, size: content.BODY_SIZE }, paragraph: { spacing: { before: 200, after: 100 }, keepNext: true } },
    },
  },
  sections: [
    {
      properties: {
        page: {
          size: { width: 12240, height: 15840 }, // US Letter
          margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 },
        },
      },
      children: [
        ...content.front,
        ...content.introduction,
        ...content.relatedWork,
        ...content.systemMethod,
        ...content.results,
        ...content.discussion,
        ...content.appendix,
        ...content.references,
      ],
    },
  ],
});

Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync("smart-road-guardian-ieee.docx", buf);
  console.log("wrote smart-road-guardian-ieee.docx", buf.length, "bytes");
});
