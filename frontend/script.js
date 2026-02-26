const API = "http://localhost:5000";

let loggedInUser = null;

// ===== ELEMENTS =====
const loginSection = document.getElementById("loginSection");
const mainSection = document.getElementById("mainSection");
const loginBtn = document.getElementById("loginBtn");
const loginMsg = document.getElementById("loginMsg");
const logoutBtn = document.getElementById("logoutBtn");
const settingsBtn = document.getElementById("settingsBtn");
const settingsPanel = document.getElementById("settingsPanel");
const list = document.getElementById("fileList");
const filesArea = document.getElementById("filesArea");
const previewArea = document.getElementById("previewArea");
const previewBox = document.getElementById("previewBox");
const sortSelect = document.getElementById("sortSelect");

// ===== SEARCH INPUT =====
const searchInput = document.createElement("input");
searchInput.placeholder = "Search files...";
searchInput.style.width = "100%";
searchInput.style.marginBottom = "10px";
list.parentNode.insertBefore(searchInput, list);

// ===== SIGNUP =====
document.getElementById("signupBtn").onclick = async () => {
  const username = document.getElementById("signupUsername").value.trim();
  const password = document.getElementById("signupPassword").value.trim();
  const msg = document.getElementById("signupMsg");

  msg.textContent = "";
  msg.style.color = "red";

  if (!username || !password) {
    msg.textContent = "Enter username and password";
    return;
  }

  try {
    const res = await fetch(`${API}/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    msg.style.color = data.success ? "green" : "red";
    msg.textContent = data.message;
  } catch {
    msg.textContent = "Signup failed";
  }
};

// ===== LOGIN =====
loginBtn.onclick = async () => {
  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value.trim();
  loginMsg.textContent = "";

  if (!username || !password) {
    loginMsg.textContent = "Enter username and password";
    return;
  }

  try {
    const res = await fetch(`${API}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();

    if (!data.success) {
      loginMsg.textContent = data.message;
      return;
    }

    loggedInUser = username;
    loginSection.style.display = "none";
    mainSection.style.display = "block";
    loadFiles();
  } catch {
    loginMsg.textContent = "Server error";
  }
};
   // ===== SIMPLE FORGOT PASSWORD =====
document.getElementById("forgotLink").onclick = async () => {

  const username = document.getElementById("username").value.trim();

  if(!username){
    alert("Enter your username first");
    return;
  }

  const newPassword = prompt("Enter new password:");
  if(!newPassword) return;

  const confirmPassword = prompt("Confirm new password:");
  if(newPassword !== confirmPassword){
    alert("Passwords do not match");
    return;
  }

  try {
    const res = await fetch(`${API}/forgot-password`,{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({username,newPassword})
    });

    const data = await res.json();
    alert(data.message);

  } catch {
    alert("Reset failed");
  }
};
// ===== LOGOUT =====
logoutBtn.onclick = () => {
  loggedInUser = null;
  loginSection.style.display = "block";
  mainSection.style.display = "none";
  list.innerHTML = "";
  previewBox.innerHTML = "";
  filesArea.style.display = "block";
  previewArea.style.display = "none";
  settingsBtn.style.display = "inline-block";
  settingsPanel.style.display = "none";
};

// ===== SETTINGS PANEL =====
settingsBtn.onclick = () => {
  settingsPanel.style.display =
    settingsPanel.style.display === "none" ? "block" : "none";
};

// ===== UPDATE ACCOUNT =====
document.getElementById("updateAccountBtn").onclick = async () => {
  const newUsername = document.getElementById("newUsername").value.trim();
  const newPassword = document.getElementById("newPassword").value;
  const confirmPassword = document.getElementById("confirmPassword").value;
  const msg = document.getElementById("accountMsg");

  msg.textContent = "";
  msg.style.color = "red";

  if (!newUsername || !newPassword || !confirmPassword) {
    msg.textContent = "All fields are required";
    return;
  }

  if (newPassword !== confirmPassword) {
    msg.textContent = "Passwords do not match";
    return;
  }

  try {
    const res = await fetch(`${API}/update-account`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: loggedInUser,
        newUsername,
        newPassword
      })
    });
    const data = await res.json();

    msg.style.color = data.success ? "green" : "red";
    msg.textContent = data.message;

    if (data.success) {
      loggedInUser = newUsername;
      document.getElementById("newUsername").value = "";
      document.getElementById("newPassword").value = "";
      document.getElementById("confirmPassword").value = "";
      loadFiles();
    }
  } catch {
    msg.style.color = "red";
    msg.textContent = "Update failed (server error)";
  }
};

// ===== UPLOAD =====
document.getElementById("uploadForm").onsubmit = async e => {
  e.preventDefault();
  if (!loggedInUser) return alert("Not logged in");

  const formData = new FormData(e.target);
  formData.append("username", loggedInUser);

  try {
    const res = await fetch(`${API}/upload`, { method: "POST", body: formData });
    const data = await res.json();
    alert(data.message);
    loadFiles();
  } catch {
    alert("Upload failed");
  }
};

// ===== LOAD FILES WITH SORT & SEARCH =====
async function loadFiles() {
  if (!loggedInUser) return;

  try {
    const res = await fetch(`${API}/files?username=${loggedInUser}`);
    let files = await res.json();

    // ===== SEARCH =====
    const searchTerm = searchInput.value.toLowerCase();
    if (searchTerm) {
      files = files.filter(f => f.name.toLowerCase().includes(searchTerm));
    }

    // ===== SORT =====
    const sortType = sortSelect.value;
    if (sortType === "a-z") files.sort((a, b) => a.name.localeCompare(b.name));
    if (sortType === "z-a") files.sort((a, b) => b.name.localeCompare(a.name));
    if (sortType === "date") files.sort((a, b) => new Date(b.date) - new Date(a.date));

    // ===== RENDER FILES =====
    list.innerHTML = "";
    previewBox.innerHTML = "";

    files.forEach(f => {
      const name = encodeURIComponent(f.name);
      list.innerHTML += `
        <li class="file-item">
          <span class="file-name">${f.name}</span>
          <div class="menu-wrapper">
            <button class="menu-btn" onclick="toggleMenu(this)">⋮</button>
            <div class="menu">
              <button onclick="previewFile('${name}','${f.type}')">View</button>
              <a href="${API}/download/${loggedInUser}/${name}">Download</a>
              <button onclick="renameFile('${name}')">Rename</button>
              <button onclick="deleteFile('${name}')">Delete</button>
            </div>
          </div>
        </li>
      `;
    });
  } catch {
    alert("Failed to load files");
  }
}

// ===== EVENTS =====
sortSelect.addEventListener("change", loadFiles);
searchInput.addEventListener("input", loadFiles);

// ===== MENU =====
function toggleMenu(btn) {
  document.querySelectorAll(".menu").forEach(m => {
    if (m !== btn.nextElementSibling) m.style.display = "none";
  });
  const menu = btn.nextElementSibling;
  menu.style.display = menu.style.display === "block" ? "none" : "block";
}

document.addEventListener("click", e => {
  if (!e.target.closest(".menu-wrapper")) {
    document.querySelectorAll(".menu").forEach(m => (m.style.display = "none"));
  }
});

// ===== PREVIEW =====
function previewFile(name, type) {
  const url = `${API}/preview/${loggedInUser}/${name}`;
  let content = "";

  if (type === ".mp4") content = `<video controls src="${url}"></video>`;
  else if (type === ".mp3") content = `<audio controls src="${url}"></audio>`;
  else if ([".jpg", ".jpeg", ".png", ".gif"].includes(type))
    content = `<img src="${url}">`;
  else content = `<iframe src="${url}"></iframe>`;

  filesArea.style.display = "none";
  settingsBtn.style.display = "none";
  settingsPanel.style.display = "none";
  previewArea.style.display = "block";

  previewBox.innerHTML = `
    <button onclick="closePreview()">⬅ Back</button><br><br>
    ${content}
  `;
}

function closePreview() {
  previewBox.innerHTML = "";
  previewArea.style.display = "none";
  filesArea.style.display = "block";
  settingsBtn.style.display = "inline-block";
}

// ===== DELETE =====
async function deleteFile(name) {
  if (!confirm("Delete this file?")) return;
  await fetch(`${API}/delete/${loggedInUser}/${decodeURIComponent(name)}`, { method: "DELETE" });
  loadFiles();
}

// ===== RENAME =====
async function renameFile(oldName) {
  const newName = prompt("Enter new file name:");
  if (!newName) return;

  await fetch(`${API}/rename`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: loggedInUser,
      oldName: decodeURIComponent(oldName),
      newName
    })
  });

  loadFiles();
}

// ===== BACKUP =====
document.getElementById("backupBtn").onclick = async () => {
  const res = await fetch(`${API}/backup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: loggedInUser })
  });
  const data = await res.json();
  alert(data.message);
};

// ===== RESTORE =====
document.getElementById("restoreBtn").onclick = async () => {
  const date = document.getElementById("restoreDate").value;
  if (!date) return alert("Select date");

  if (!confirm("Restore will overwrite files. Continue?")) return;

  const res = await fetch(`${API}/restore`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: loggedInUser, date })
  });

  const data = await res.json();
  alert(data.message);
  loadFiles();
};
