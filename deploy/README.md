# Deploying on the Vinmec server

One Linux server runs the whole app with Docker Compose: Nginx (HTTPS) → app → PostgreSQL 16.
A small virtual machine is enough: 2 CPU cores, 4 GB RAM, 100 GB disk, Ubuntu 24.04 LTS, Docker installed.
The app is reachable only on the hospital network.

## What IT provides

- The server, an internal name (for example `tsg.vinmec.local`) and an HTTPS certificate for it from the
  hospital certificate authority: `server.crt` and `server.key`.
- An LDAP/AD service account that can search users, plus three groups: sonographers, doctors, administrators.
- A backup location and the people who receive alerts.

## Install

```bash
git clone https://github.com/hawey2/VMEC--Preeclampsia-and-Fetal-Growth.git /opt/pe-risk
cd /opt/pe-risk/deploy
cp .env.example .env          # fill in passwords, LDAP settings and group names
mkdir certs && cp /path/to/server.crt /path/to/server.key certs/
docker compose build
docker compose up -d          # creates the tables on first start
docker compose ps             # all three services should be "healthy" or "running"
```

Then sign in as a member of the administrator group, check the audit log screen, and run the acceptance cases
in the [build and deploy plan](https://claude.ai/artifact/Wmig1H4MJ257rVowTXo4cv).

## Backups

`backup.sh` writes an encrypted `pg_dump` every night and keeps 30 days:

```bash
echo 'BACKUP_PASSPHRASE=<long random string, stored in the IT password vault>' > backup.env
chmod 600 backup.env
crontab -e   # 15 1 * * * /opt/pe-risk/deploy/backup.sh /mnt/vinmec-backup/pe-risk
```

The restore command is at the end of the script. Test a restore once a month on a spare database.

## Update to a new version

```bash
cd /opt/pe-risk && git pull
cd deploy && docker compose build && docker compose up -d   # database changes run automatically
```

To roll back, check out the previous release tag and run the same two commands. Take a backup before every update.

## Monitoring

The app answers `GET /api/health`; Docker restarts it if the check fails. Point the hospital monitoring at
`https://<server>/api/health` and alert if it fails or the disk passes 80%.
