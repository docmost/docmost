prod:
	docker compose -f docker-compose.yml up

start:
	docker compose -f docker-compose.dev.yaml up -d

stop:
	@echo ~#~#~#~ CHECK THAT BACKAP CONTAINER NOT RUNNING TASK [or yoy gona need kill it with own hands] ~#~#~#~
	docker compose down --volumes --remove-orphans
	docker rmi -f docmost-docmost:latest

restart:
	-docker compose down --volumes
	-docker compose -f docker-compose.dev.yaml up -d

# todo backup_20250404_213407 as param
restore:
	-sudo rm -r ./data 
	-sudo chmod -R 0777 ./backups
	-mkdir data
	-tar -xzf ./backups/backup_20250415_195407.tar.gz -C ./data