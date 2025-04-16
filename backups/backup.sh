#!/bin/bash

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

DATA_PATH="/data"

BACKUP_PATH="/backups"

tar -czf $BACKUP_PATH/backup_$TIMESTAMP.tar.gz -C $DATA_PATH .

echo "Backup created at $BACKUP_PATH/backup_$TIMESTAMP.tar.gz"
