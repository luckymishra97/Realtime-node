const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const bodyParser = require("body-parser");
const mysql = require("mysql2");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", 
    methods: ["GET", "POST", "PUT", "DELETE"],
  },
});


app.use(cors());
app.use(bodyParser.json());


// const db = mysql.createConnection({
//   host: "localhost",
//   user: "root",
//   password: "",
//   database: "taskdb",
// });

const db = mysql.createConnection({
  host: process.env.DB_HOST, 
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

db.connect((err) => {
  if (err) {
    console.error("Error connecting to MySQL:", err);
    process.exit(1);
  }
  console.log("Connected to MySQL database!");
});


io.on("connection", (socket) => {
  console.log("New client connected:", socket.id);


  socket.on("task-changed", (data) => {
    io.emit("task-updated", data);
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
  });
});

app.get("/tasks", (req, res) => {
  db.query("SELECT * FROM tasks", (err, results) => {
    if (err) {
      return res.status(500).send("Error fetching tasks");
    }
    res.json(results);
  });
});


app.post("/addTask", (req, res) => {
  const { name, status } = req.body;
  if (!name || !status) {
    return res.status(400).json({ message: "Name and status are required." });
  }

  const query = "INSERT INTO tasks (name, status) VALUES (?, ?)";
  db.query(query, [name, status], (err, result) => {
    if (err) {
      return res.status(500).send("Error adding task");
    }

    const newTask = { id: result.insertId, name, status, createdAt: new Date() };
    io.emit("task-changed", { type: "added", task: newTask }); // Notify clients
    res.status(201).json(newTask);
  });
});

app.delete("/tasks/:id", (req, res) => {
  const taskId = req.params.id;
  const query = "DELETE FROM tasks WHERE id = ?";
  db.query(query, [taskId], (err, result) => {
    if (err) {
      return res.status(500).send("Error deleting task");
    }

    io.emit("task-changed", { type: "deleted", taskId }); // Notify clients
    res.status(200).json({ message: "Task deleted successfully", taskId });
  });
});


app.put("/tasks/:id", (req, res) => {
  const taskId = req.params.id;
  const { name, status } = req.body;
  const query = "UPDATE tasks SET name = ?, status = ? WHERE id = ?";
  db.query(query, [name, status, taskId], (err, result) => {
    if (err) {
      return res.status(500).send("Error updating task");
    }

    const updatedTask = { id: taskId, name, status };
    io.emit("task-changed", { type: "updated", task: updatedTask }); // Notify clients
    res.status(200).json(updatedTask);
  });
});


// const PORT = process.env.PORT || 5000;
// server.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

