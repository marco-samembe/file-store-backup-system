const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const cors = require("cors");

const app = express();
const PORT = 5000;

const UPLOADS = path.join(__dirname, "uploads");
const BACKUPS = path.join(__dirname, "backups");
const USERS = path.join(__dirname, "users.json");

// Create folders/files if missing
if (!fs.existsSync(UPLOADS)) fs.mkdirSync(UPLOADS);
if (!fs.existsSync(BACKUPS)) fs.mkdirSync(BACKUPS);
if (!fs.existsSync(USERS)) fs.writeFileSync(USERS, "{}");

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "../frontend"))); // serve frontend

/* ===== MULTER ===== */
const storage = multer.diskStorage({
  destination: UPLOADS,
  filename: (req, file, cb) => cb(null, file.originalname)
});
const upload = multer({ storage });

/* ===== HELPERS ===== */
const readUsers = () => JSON.parse(fs.readFileSync(USERS));
const saveUsers = u => fs.writeFileSync(USERS, JSON.stringify(u, null, 2));

const getUserFolder = username => {
  const dir = path.join(UPLOADS, username);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
};

const getUserBackupFolder = username => {
  const dir = path.join(BACKUPS, username);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
};

/* ================= AUTH ================= */

/* SIGNUP */
app.post("/signup", (req, res) => {
  const { username, password } = req.body;
  const users = readUsers();

  if (!username || !password)
    return res.json({ success: false, message: "Missing data" });

  if (users[username])
    return res.json({ success: false, message: "User already exists" });

  users[username] = { password };
  saveUsers(users);

  getUserFolder(username);
  getUserBackupFolder(username);

  res.json({ success: true, message: "Signup successful" });
});

/* LOGIN */
app.post("/login", (req, res) => {
  const { username, password } = req.body;
  const users = readUsers();

  if (!users[username] || users[username].password !== password)
    return res.json({ success: false, message: "Invalid credentials" });

  res.json({ success: true });
});

/* 🔥 UPDATE ACCOUNT */
app.post("/update-account", (req, res) => {
  try {
    const { username, newUsername, newPassword } = req.body;
    const users = readUsers();

    if (!username || !newUsername || !newPassword)
      return res.json({ success: false, message: "Missing data" });

    if (!users[username])
      return res.json({ success: false, message: "User not found" });

    if (newUsername !== username && users[newUsername])
      return res.json({ success: false, message: "Username already exists" });

    /* update users.json */
    delete users[username];
    users[newUsername] = { password: newPassword };
    saveUsers(users);

    /* rename uploads folder safely */
    const oldUpload = path.join(UPLOADS, username);
    const newUpload = path.join(UPLOADS, newUsername);
    if (fs.existsSync(oldUpload)) fs.renameSync(oldUpload, newUpload);
    else fs.mkdirSync(newUpload, { recursive: true });

    /* rename backups folder safely */
    const oldBackup = path.join(BACKUPS, username);
    const newBackup = path.join(BACKUPS, newUsername);
    if (fs.existsSync(oldBackup)) fs.renameSync(oldBackup, newBackup);
    else fs.mkdirSync(newBackup, { recursive: true });

    res.json({ success: true, message: "Account updated successfully" });
  } catch (err) {
    console.error("UPDATE ACCOUNT ERROR:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

/* ================= FILES ================= */

app.post("/upload", upload.single("file"), (req, res) => {
  const username = req.body.username;
  if (!username) return res.json({ message: "No user provided" });

  const userFolder = getUserFolder(username);
  fs.renameSync(req.file.path, path.join(userFolder, req.file.originalname));

  res.json({ message: "File uploaded successfully" });
});

app.get("/files", (req, res) => {
  const username = req.query.username;
  if (!username) return res.json([]);

  const userFolder = getUserFolder(username);
  const files = fs.readdirSync(userFolder).map(f => ({
    name: f,
    type: path.extname(f).toLowerCase()
  }));

  res.json(files);
});

app.post("/rename", (req, res) => {
  const { username, oldName, newName } = req.body;
  const userFolder = getUserFolder(username);

  const oldPath = path.join(userFolder, oldName);
  const newPath = path.join(userFolder, newName);

  if (!fs.existsSync(oldPath)) return res.json({ success: false, message: "Original file not found" });
  if (fs.existsSync(newPath)) return res.json({ success: false, message: "New file name already exists" });

  try {
    fs.renameSync(oldPath, newPath);
    res.json({ success: true, message: "File renamed successfully" });
  } catch (err) {
    console.error(err);
    res.json({ success: false, message: "Rename failed" });
  }
});

app.delete("/delete/:username/:name", (req, res) => {
  const { username, name } = req.params;
  const file = path.join(getUserFolder(username), name);
  if (fs.existsSync(file)) fs.unlinkSync(file);
  res.json({ message: "File deleted" });
});

/* ================= BACKUP ================= */

app.post("/backup", (req, res) => {
  const { username } = req.body;
  const userFolder = getUserFolder(username);
  const backupFolder = path.join(getUserBackupFolder(username), new Date().toISOString().split("T")[0]);

  fs.mkdirSync(backupFolder, { recursive: true });

  fs.readdirSync(userFolder).forEach(f =>
    fs.copyFileSync(path.join(userFolder, f), path.join(backupFolder, f))
  );

  res.json({ message: "Backup completed" });
});

app.post("/restore", (req, res) => {
  const { username, date } = req.body;
  const backupFolder = path.join(getUserBackupFolder(username), date);

  if (!fs.existsSync(backupFolder))
    return res.json({ message: "Backup not found" });

  const userFolder = getUserFolder(username);

  fs.readdirSync(userFolder).forEach(f =>
    fs.unlinkSync(path.join(userFolder, f))
  );

  fs.readdirSync(backupFolder).forEach(f =>
    fs.copyFileSync(path.join(backupFolder, f), path.join(userFolder, f))
  );

  res.json({ message: "Restore completed" });
});

/* ================= PREVIEW / DOWNLOAD ================= */

app.get("/preview/:username/:name", (req, res) => {
  const { username, name } = req.params;
  const file = path.join(getUserFolder(username), name);
  if (!fs.existsSync(file)) return res.sendStatus(404);
  res.sendFile(file);
});

app.get("/download/:username/:name", (req, res) => {
  const { username, name } = req.params;
  const file = path.join(getUserFolder(username), name);
  if (!fs.existsSync(file)) return res.sendStatus(404);
  res.download(file);
});

/* ================= START SERVER ================= */
app.listen(PORT, () => console.log(`✅ Server running at http://localhost:${PORT}`));
