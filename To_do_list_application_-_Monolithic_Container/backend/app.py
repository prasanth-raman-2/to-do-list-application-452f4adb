"""
Flask backend for monolithic To-Do List application.

Implements API for:
- Task CRUD (Create, Read, Update, Delete)
- Toggle completion status
- Filtering, sorting, searching
- Bulk operations
- (Optional) User authentication with JWT (can disable if single-user mode desired)
- Error handling

Uses SQLite for persistence.
"""

import os
from flask import Flask, jsonify, request, abort
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash
import jwt
from functools import wraps
from datetime import datetime, timedelta

# === CONFIG ===
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "todo.sqlite")
JWT_SECRET = os.environ.get('JWT_SECRET', "dev_secret_change_this")
JWT_EXPIRY_HOURS = 12
SINGLE_USER_MODE = True  # Set to False to enable multi-user registration/login

app = Flask(__name__)
CORS(app)
app.config['SQLALCHEMY_DATABASE_URI'] = f"sqlite:///{DB_PATH}"
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)

# === MODELS ===
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(32), unique=True)
    password_hash = db.Column(db.String(128))
    tasks = db.relationship('Task', backref='user', lazy=True)

    def set_password(self, pw: str):
        self.password_hash = generate_password_hash(pw)
    def check_password(self, pw: str):
        return check_password_hash(self.password_hash, pw)

class Task(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text, default="")
    completed = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow)
    due_date = db.Column(db.DateTime, nullable=True)
    priority = db.Column(db.String(16), default="normal") # e.g. "low", "normal", "high"
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=True)  # nullable in single-user mode

    def to_dict(self):
        return dict(
            id=self.id,
            title=self.title,
            description=self.description,
            completed=self.completed,
            created_at=self.created_at.isoformat() if self.created_at else None,
            updated_at=self.updated_at.isoformat() if self.updated_at else None,
            due_date=self.due_date.isoformat() if self.due_date else None,
            priority=self.priority,
            user_id=self.user_id,
        )

# --- Auth helpers (can be skipped if not needed) ---
def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if SINGLE_USER_MODE:
            # No authentication, always "user 1"
            return f(*args, user_id=1, **kwargs)
        token = None
        if "x-access-token" in request.headers:
            token = request.headers["x-access-token"]
        if not token:
            return jsonify({'message': 'Token is missing!'}), 401
        try:
            data = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
            user_id = data["id"]
        except Exception:
            return jsonify({'message': 'Token is invalid!'}), 401
        return f(*args, user_id=user_id, **kwargs)
    return decorated

# --- ROUTES ---

# PUBLIC_INTERFACE
@app.route("/api/auth/register", methods=["POST"])
def register():
    """Register a new user (not used when SINGLE_USER_MODE True)."""
    if SINGLE_USER_MODE:
        abort(403)
    data = request.get_json()
    if not data or not 'username' in data or not 'password' in data:
        abort(400)
    if User.query.filter_by(username=data['username']).first():
        return jsonify({"error": "Username already exists"}), 409
    u = User(username=data['username'])
    u.set_password(data['password'])
    db.session.add(u)
    db.session.commit()
    return jsonify({"message": "User created"}), 201

# PUBLIC_INTERFACE
@app.route("/api/auth/login", methods=["POST"])
def login():
    """Authenticate user (JWT), not used in SINGLE_USER_MODE."""
    if SINGLE_USER_MODE:
        abort(403)
    data = request.get_json()
    if not data or not 'username' in data or not 'password' in data:
        abort(400)
    user = User.query.filter_by(username=data['username']).first()
    if not user or not user.check_password(data['password']):
        return jsonify({"error": "Invalid credentials"}), 401
    token = jwt.encode({
        "id": user.id,
        "exp": datetime.utcnow() + timedelta(hours=JWT_EXPIRY_HOURS)
    }, JWT_SECRET, algorithm="HS256")
    return jsonify({"token": token})

# PUBLIC_INTERFACE
@app.route("/api/tasks", methods=["GET"])
@token_required
def get_tasks(user_id):
    """
    Get all tasks for the current user, with filtering, sorting, searching.
    Query params:
      - completed: 'true'/'false'
      - q: search string (title/description)
      - sort_by: created_at|due_date|priority
      - sort_order: asc|desc
      - priority: low|normal|high
    """
    query = Task.query
    if not SINGLE_USER_MODE:
        query = query.filter_by(user_id=user_id)
    q = request.args.get("q")
    if q:
        q = f"%{q.lower()}%"
        query = query.filter(
            db.or_(
                db.func.lower(Task.title).like(q),
                db.func.lower(Task.description).like(q)
            )
        )
    completed = request.args.get("completed")
    if completed == "true":
        query = query.filter_by(completed=True)
    elif completed == "false":
        query = query.filter_by(completed=False)
    priority = request.args.get("priority")
    if priority:
        query = query.filter_by(priority=priority)
    # Sorting
    sort_by = request.args.get("sort_by", "created_at")
    sort_order = request.args.get("sort_order", "desc")
    if sort_by not in ["created_at", "due_date", "priority"]:
        sort_by = "created_at"
    col = getattr(Task, sort_by)
    if sort_order == "asc":
        query = query.order_by(col.asc())
    else:
        query = query.order_by(col.desc())
    tasks = [t.to_dict() for t in query.all()]
    return jsonify(tasks)

# PUBLIC_INTERFACE
@app.route("/api/tasks", methods=["POST"])
@token_required
def create_task(user_id):
    """
    Create a new task.
    Request JSON: {title, description, due_date, priority}
    """
    data = request.get_json()
    if not data or not "title" in data:
        return jsonify({"error": "Task title is required"}), 400
    t = Task(
        title=data["title"],
        description=data.get("description", ""),
        due_date=datetime.fromisoformat(data["due_date"]) if data.get("due_date") else None,
        priority=data.get("priority", "normal"),
        completed=data.get("completed", False),
        user_id=user_id if not SINGLE_USER_MODE else None
    )
    db.session.add(t)
    db.session.commit()
    return jsonify(t.to_dict()), 201

# PUBLIC_INTERFACE
@app.route("/api/tasks/<int:task_id>", methods=["PUT"])
@token_required
def update_task(task_id, user_id):
    """
    Update a task.
    Request JSON: may include any fields to update.
    """
    t = Task.query.get(task_id)
    if not t:
        return jsonify({"error": "Task not found"}), 404
    if not SINGLE_USER_MODE and t.user_id != user_id:
        return jsonify({"error": "Not authorized"}), 403
    data = request.get_json()
    if "title" in data:
        t.title = data["title"]
    if "description" in data:
        t.description = data["description"]
    if "due_date" in data:
        t.due_date = datetime.fromisoformat(data["due_date"]) if data["due_date"] else None
    if "priority" in data:
        t.priority = data["priority"]
    if "completed" in data:
        t.completed = data["completed"]
    t.updated_at = datetime.utcnow()
    db.session.commit()
    return jsonify(t.to_dict())

# PUBLIC_INTERFACE
@app.route("/api/tasks/<int:task_id>", methods=["DELETE"])
@token_required
def delete_task(task_id, user_id):
    """
    Delete a task.
    """
    t = Task.query.get(task_id)
    if not t:
        return jsonify({"error": "Task not found"}), 404
    if not SINGLE_USER_MODE and t.user_id != user_id:
        return jsonify({"error": "Not authorized"}), 403
    db.session.delete(t)
    db.session.commit()
    return jsonify({"message": "Deleted"})

# PUBLIC_INTERFACE
@app.route("/api/tasks/<int:task_id>/toggle", methods=["POST"])
@token_required
def toggle_task_completion(task_id, user_id):
    """Toggle completion status of a task."""
    t = Task.query.get(task_id)
    if not t:
        return jsonify({"error": "Task not found"}), 404
    if not SINGLE_USER_MODE and t.user_id != user_id:
        return jsonify({"error": "Not authorized"}), 403
    t.completed = not t.completed
    t.updated_at = datetime.utcnow()
    db.session.commit()
    return jsonify(t.to_dict())

# PUBLIC_INTERFACE
@app.route("/api/tasks/bulk", methods=["POST"])
@token_required
def bulk_ops(user_id):
    """
    Bulk operations on tasks.
    Request JSON: {action: "delete"|"complete"|"incomplete", ids: [task_id,...]}
    """
    data = request.get_json()
    ids = data.get("ids", [])
    action = data.get("action")
    if not ids or not action:
        return jsonify({"error": "Both 'ids' and 'action' required"}), 400
    query = Task.query.filter(Task.id.in_(ids))
    if not SINGLE_USER_MODE:
        query = query.filter_by(user_id=user_id)
    count = 0
    if action == "delete":
        count = query.delete(synchronize_session=False)
    elif action == "complete":
        count = query.update({Task.completed: True, Task.updated_at: datetime.utcnow()})
    elif action == "incomplete":
        count = query.update({Task.completed: False, Task.updated_at: datetime.utcnow()})
    else:
        return jsonify({"error": "Invalid action"}), 400
    db.session.commit()
    return jsonify({"success": True, "count": count})

# PUBLIC_INTERFACE
@app.route("/api/status", methods=["GET"])
def status():
    """Healthcheck/status endpoint."""
    return jsonify({"status": "ok"})

# --- DB INITIALIZATION ---
@app.cli.command("initdb")
def initdb():
    """Initialize the database and (optionally) create a default user."""
    db.create_all()
    if SINGLE_USER_MODE:
        if not User.query.get(1):
            u = User(id=1, username="admin")
            u.set_password("admin")
            db.session.add(u)
            db.session.commit()
        print("Database initialized (single-user mode, default user created: admin/admin).")
    else:
        print("Database initialized (multi-user mode).")

if __name__ == "__main__":
    # Initial DB create if DB file missing
    if not os.path.exists(DB_PATH):
        with app.app_context():
            db.create_all()
            if SINGLE_USER_MODE and not User.query.get(1):
                u = User(id=1, username="admin")
                u.set_password("admin")
                db.session.add(u)
                db.session.commit()
    app.run(host='0.0.0.0', port=5000, debug=True)
