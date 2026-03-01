const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");
const { Pool } = require("pg");
const cors = require("cors");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

const PORT = process.env.PORT || 3000;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
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

    const answers = await pool.query(
      "SELECT question_no, correct_option FROM answer_keys WHERE exam_id=$1",
      [examId]
    );

    let answerKey = {};
    answers.rows.forEach(row => {
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

    const exam = await pool.query(
      "SELECT marks_per_question, negative_marks FROM exams WHERE id=$1",
      [examId]
    );

    if (exam.rows.length === 0) {
      return res.status(400).json({ error: "Exam not found in database" });
    }

    const score =
      correct * exam.rows[0].marks_per_question -
      wrong * exam.rows[0].negative_marks;

    await pool.query(
      `INSERT INTO submissions
       (exam_id, score, correct, wrong, unattempted)
       VALUES ($1, $2, $3, $4, $5)`,
      [examId, score, correct, wrong, unattempted]
    );

    const rankResult = await pool.query(
      `SELECT COUNT(*) + 1 AS rank
       FROM submissions
       WHERE exam_id=$1 AND score > $2`,
      [examId, score]
    );

    res.json({
      correct,
      wrong,
      unattempted,
      score: score.toFixed(2),
      rank: rankResult.rows[0].rank
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }

});

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
