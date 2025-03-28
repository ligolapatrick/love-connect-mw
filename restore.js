<<<<<<< HEAD
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

const backupsDir = path.join(__dirname, 'backups');
const backupFiles = fs.readdirSync(backupsDir).filter(file => file.endsWith('.sql'));
if (backupFiles.length === 0) {
  console.error('No backup files found');
  process.exit(1);
}

const latestBackup = path.join(backupsDir, backupFiles.sort().reverse()[0]);
const command = `sqlite3 database.sqlite < ${latestBackup}`;

exec(command, (err) => {
  if (err) {
    console.error('Error restoring backup:', err);
  } else {
    console.log('Backup restored successfully:', latestBackup);
  }
});
=======
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

const backupsDir = path.join(__dirname, 'backups');
const backupFiles = fs.readdirSync(backupsDir).filter(file => file.endsWith('.sql'));
if (backupFiles.length === 0) {
  console.error('No backup files found');
  process.exit(1);
}

const latestBackup = path.join(backupsDir, backupFiles.sort().reverse()[0]);
const command = `sqlite3 database.sqlite < ${latestBackup}`;

exec(command, (err) => {
  if (err) {
    console.error('Error restoring backup:', err);
  } else {
    console.log('Backup restored successfully:', latestBackup);
  }
});
>>>>>>> 2de31ece0949820ad91ac622e066bf758efac226
