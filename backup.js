const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

// Create backups directory if it doesn't exist
const backupsDir = path.join(__dirname, 'backups');
if (!fs.existsSync(backupsDir)) {
  fs.mkdirSync(backupsDir);
}

const backupFile = path.join(backupsDir, `backup-${Date.now()}.sql`);
const command = `sqlite3 database.sqlite .dump > ${backupFile}`;

exec(command, (err) => {
  if (err) {
    console.error('Error creating backup:', err);
  } else {
    console.log('Backup created successfully:', backupFile);
  }
});
