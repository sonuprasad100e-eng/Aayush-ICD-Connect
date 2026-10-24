
from flask import Flask, request, jsonify
from flask_cors import CORS
import sqlite3
from pathlib import Path

app = Flask(__name__)
CORS(app)

DB_PATH = Path(__file__).with_name("aayush_icd.db")


def connect_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def initialize_db():
    with connect_db() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS mappings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                ayush_term TEXT NOT NULL,
                ayush_code TEXT DEFAULT '',
                icd_term TEXT NOT NULL,
                icd_code TEXT DEFAULT '',
                source TEXT DEFAULT 'Unverified demo record'
            )
        """)


@app.route("/")
def home():
    return jsonify({
        "project": "Aayush-ICD Connect",
        "server": "running",
        "message": "Backend API is ready"
    })


@app.route("/api/health")
def health():
    return jsonify({"status": "ok"})



@app.route("/api/mappings", methods=["GET"])
def get_mappings():
    search_term = request.args.get("search", "").strip()

    with connect_db() as conn:
        if search_term:
            rows = conn.execute("""
                SELECT * FROM mappings
                WHERE ayush_term LIKE ?
                   OR ayush_code LIKE ?
                   OR icd_term LIKE ?
                   OR icd_code LIKE ?
                ORDER BY id DESC
            """, tuple([f"%{search_term}%"] * 4)).fetchall()
        else:
            rows = conn.execute(
                "SELECT * FROM mappings ORDER BY id DESC"
            ).fetchall()

    return jsonify([dict(row) for row in rows])


@app.route("/api/mappings", methods=["POST"])
def add_mapping():
    data = request.get_json(silent=True) or {}

    ayush_term = str(data.get("ayush_term", "")).strip()
    icd_term = str(data.get("icd_term", "")).strip()

    if not ayush_term or not icd_term:
        return jsonify({
            "error": "AYUSH term and ICD term are required"
        }), 400

    with connect_db() as conn:
        cursor = conn.execute("""
            INSERT INTO mappings
            (ayush_term, ayush_code, icd_term, icd_code, source)
            VALUES (?, ?, ?, ?, ?)
        """, (
            ayush_term,
            str(data.get("ayush_code", "")).strip(),
            icd_term,
            str(data.get("icd_code", "")).strip(),
            str(data.get("source", "Unverified demo record")).strip()
        ))

        mapping_id = cursor.lastrowid

    return jsonify({
        "message": "Mapping saved successfully",
        "id": mapping_id
    }), 201


if __name__ == "__main__":
    initialize_db()
    app.run(host="127.0.0.1", port=5000, debug=False)
