const express = require("express");
const path = require("path");
const { MongoClient } = require("mongodb");

const app = express();
const port = process.env.PORT || 3000;
const mongoUri = process.env.MONGODB_URI;

app.use(express.static("public"));

let collection;

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function showResults(search, searchType, companies, message) {
  const rows = companies
    .map((company) => `
      <tr>
        <td>${escapeHtml(company.company)}</td>
        <td>${escapeHtml(company.ticker)}</td>
        <td>$${Number(company.price).toFixed(2)}</td>
      </tr>
    `)
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Search Results</title>
  <link rel="stylesheet" href="/styles.css">
</head>
<body>
  <main class="page">
    <section class="results-panel">
      <h1>Search Results</h1>
      <p class="search-summary">
        Search: <strong>${escapeHtml(search)}</strong>
        ${searchType ? `by <strong>${escapeHtml(searchType)}</strong>` : ""}
      </p>

      ${message ? `<p class="message">${escapeHtml(message)}</p>` : ""}

      ${companies.length > 0 ? `
        <table>
          <thead>
            <tr>
              <th>Company</th>
              <th>Ticker</th>
              <th>Price</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      ` : ""}

      <a class="back-link" href="/">Search again</a>
    </section>
  </main>
</body>
</html>`;
}

async function connectToDatabase() {
  if (!mongoUri) {
    throw new Error("Missing MONGODB_URI environment variable.");
  }

  const client = new MongoClient(mongoUri);
  await client.connect();
  collection = client.db("Stock").collection("PublicCompanies");
}

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "home.html"));
});

app.get("/process", async (req, res) => {
  const search = (req.query.search || "").trim();
  const searchType = req.query.searchType;

  if (!search || !["company", "ticker"].includes(searchType)) {
    return res.send(showResults(search, searchType, [], "Please enter a company or ticker symbol."));
  }

  const safeSearch = escapeRegex(search);
  const query =
    searchType === "ticker"
      ? { ticker: { $regex: `^${safeSearch}`, $options: "i" } }
      : { company: { $regex: `^${safeSearch}$`, $options: "i" } };

  const companies = await collection.find(query).toArray();

  console.log("Search:", search);
  console.log("Search type:", searchType);
  console.log(companies);

  res.send(showResults(search, searchType, companies, companies.length === 0 ? "No matching companies found." : ""));
});

connectToDatabase()
  .then(() => {
    app.listen(port, () => {
      console.log(`Server running on port ${port}`);
    });
  })
  .catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
