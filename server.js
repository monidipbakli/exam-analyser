
const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");
const mysql = require("mysql2/promise");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

const PORT = process.env.PORT || 3000;

/* ===== DATABASE CONFIG ===== */
const db = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASS || "password",
  database: process.env.DB_NAME || "examdb"
});

app.post("/analyze", async (req, res) => {
  try {
    const { url, examId } = req.body;

    if (!url || !examId) {
      return res.status(400).json({ error: "Missing URL or Exam ID" });
    }

    const response = await axios.get(url);
    const html = response.data;
    const $ = cheerio.load(html);

    const [answers] = await db.execute(
      "SELECT question_no, correct_option FROM answer_keys WHERE exam_id=?",
      [examId]
    );

    let answerKey = {};
    answers.forEach(row => {
      answerKey[row.question_no] = row.correct_option;
    });

    let correct = 0;
    let wrong = 0;
    let unattempted = 0;

    const textContent = $("body").text();
    const sections = textContent.split(/Q\.\s*\d+/i).slice(1);

    sections.forEach((section, index) => {
      const qNo = index + 1;
      const chosenMatch = section.match(/Chosen\s*Option\s*:?[\sA-Za-z]*([A-D0-9]+)/i);
      const chosen = chosenMatch ? chosenMatch[1] : null;

      if (!chosen) {
        unattempted++;
      } else if (chosen == answerKey[qNo]) {
        correct++;
      } else {
        wrong++;
      }
    });

    const [examRows] = await db.execute(
      "SELECT marks_per_question, negative_marks FROM exams WHERE id=?",
      [examId]
    );

    const exam = examRows[0];

    const score =
      correct * exam.marks_per_question -
      wrong * exam.negative_marks;

    await db.execute(
      `INSERT INTO submissions
      (exam_id, score, correct, wrong, unattempted)
      VALUES (?, ?, ?, ?, ?)`,
      [examId, score, correct, wrong, unattempted]
    );

    const [rankRow] = await db.execute(
      `SELECT COUNT(*) + 1 AS rank
       FROM submissions
       WHERE exam_id=? AND score > ?`,
      [examId, score]
    );

    res.json({
      correct,
      wrong,
      unattempted,
      score: score.toFixed(2),
      rank: rankRow[0].rank
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () =>
  console.log("Server running on port " + PORT)
);
