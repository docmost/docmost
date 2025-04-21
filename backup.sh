#!/bin/bash

# Создаем временную метку
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

# Путь к директории с данными
DATA_PATH="/"

# Путь к директории для сохранения бэкапов
BACKUP_PATH="/backups"

# Создаем архив с данными
tar -czf $BACKUP_PATH/backup_$TIMESTAMP.tar.gz -C $DATA_PATH .

# Выводим сообщение о завершении
echo "Backup created at $BACKUP_PATH/backup_$TIMESTAMP.tar.gz"
