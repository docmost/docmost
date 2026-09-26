resource "aws_ebs_volume" "data" {
  availability_zone = aws_subnet.public.availability_zone # availability zone should match ec2 (so refer to subnet is safe)

  type      = "gp3"
  size      = 20
  encrypted = true

  tags = {
    Name    = "docmost-data"
    Project = "docmost"
  }

  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_volume_attachment" "data" {
  device_name = "/dev/sdf"
  volume_id   = aws_ebs_volume.data.id
  instance_id = aws_instance.docmost.id
}