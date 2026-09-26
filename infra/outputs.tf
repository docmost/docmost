output "instance_id" {
  description = "EC2 instance ID used for SSM access"
  value       = aws_instance.docmost.id
}

output "public_ip" {
  description = "Public IPv4 address of the Docmost server"
  value       = aws_instance.docmost.public_ip
}