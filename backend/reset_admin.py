"""
Root convenience wrapper for app.cli.reset_admin
Usage:
    python reset_admin.py --email admin@firm.com --password "NewPassword123!"
"""
import sys
sys.path.insert(0, ".")

from app.cli.reset_admin import main

if __name__ == "__main__":
    main()
