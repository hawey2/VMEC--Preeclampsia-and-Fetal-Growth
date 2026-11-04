# Cài đặt trên cloud

Bản này chạy cùng một ứng dụng với bản bệnh viện: PostgreSQL lưu hồ sơ nhiều bệnh nhân, có đăng nhập, phiên bản,
ký xác nhận, kết cục thai kỳ và nhật ký thao tác. Có hai điểm khác bản bệnh viện:

- **Tài khoản do ứng dụng tự quản lý**, không cần tài khoản Vinmec (LDAP). Quản trị viên tạo tài khoản và cấp mật khẩu tạm.
  Người dùng phải đổi mật khẩu ở lần đăng nhập đầu tiên. Mật khẩu được mã hoá bằng scrypt, và nhập sai 5 lần thì tài khoản
  bị khoá 15 phút.
- **HTTPS tự động:** Caddy tự lấy và gia hạn chứng chỉ Let's Encrypt cho tên miền.

> **Trước khi nhập dữ liệu bệnh nhân thật:** dữ liệu sức khoẻ là dữ liệu cá nhân nhạy cảm theo Nghị định 13/2023/NĐ-CP.
> Cần bộ phận pháp chế và CNTT của Vinmec duyệt: chọn nơi đặt máy chủ (nên ở Việt Nam), lập hồ sơ đánh giá tác động xử lý
> dữ liệu cá nhân, và có cơ chế thu thập sự đồng ý của bệnh nhân. Trước khi được duyệt, chỉ thử bằng dữ liệu giả.

## Cần chuẩn bị

1. **Một máy chủ ảo (VM)** ở nhà cung cấp cloud, ví dụ Viettel Cloud, FPT Cloud hay VNPT Cloud để dữ liệu nằm ở Việt Nam:
   - 2 vCPU, 4 GB RAM, ổ 40 GB trở lên.
   - Ubuntu 24.04 LTS, có địa chỉ IP công khai.
   - Tường lửa chỉ mở cổng 22 (SSH, nên giới hạn theo IP), 80 và 443.
2. **Một tên miền hoặc tên miền con**, ví dụ `tsg.vinmec-op2.vn`. Tạo bản ghi DNS loại A trỏ về IP của máy chủ.
3. **Một nơi lưu bản sao lưu ngoài máy chủ:** object storage của nhà cung cấp, hoặc ổ của bệnh viện.

## Cài đặt (khoảng 20 phút)

```bash
# 1. Cài Docker
curl -fsSL https://get.docker.com | sh

# 2. Lấy mã nguồn
git clone https://github.com/hawey2/VMEC--Preeclampsia-and-Fetal-Growth.git /opt/pe-risk
cd /opt/pe-risk/deploy/cloud

# 3. Cấu hình: điền tên miền, email, mật khẩu database và khoá xuất dữ liệu
cp .env.example .env
nano .env                      # mật khẩu và khoá tạo bằng: openssl rand -base64 32
chmod 600 .env

# 4. Chạy (lần đầu sẽ tạo bảng dữ liệu)
docker compose up -d --build
docker compose ps              # db, app, caddy đều phải "running"

# 5. Tạo tài khoản quản trị đầu tiên (hệ thống hỏi mật khẩu tạm hai lần, tối thiểu 10 ký tự)
docker compose exec app python -m pe_api.users add truongkhoa "Trưởng khoa" admin
```

Sau đó mở `https://<tên miền>` và đăng nhập bằng tài khoản quản trị, rồi đổi mật khẩu khi được yêu cầu.
Vào mục **Người dùng** để thêm bác sĩ và kỹ thuật viên:

- Mỗi người có một vai trò: kỹ thuật viên siêu âm, bác sĩ (được ký xác nhận) hoặc quản trị viên.
- Quản trị viên có thể khoá tài khoản, mở khoá, đổi vai trò hoặc đặt lại mật khẩu tạm.
- Khi tài khoản bị khoá hoặc đặt lại mật khẩu, người đó bị đăng xuất ngay.

Hồ sơ được lưu trong PostgreSQL trên máy chủ, nên vẫn còn sau khi đăng xuất. Lần đăng nhập sau, gõ mã bệnh nhân (PID)
để xem lại lịch sử khám.

## Sao lưu

```bash
cd /opt/pe-risk/deploy
echo 'BACKUP_PASSPHRASE=<chuỗi ngẫu nhiên dài, cất trong kho mật khẩu>' > backup.env && chmod 600 backup.env
crontab -e
# 15 1 * * * PE_COMPOSE_FILE=/opt/pe-risk/deploy/cloud/docker-compose.yml /opt/pe-risk/deploy/backup.sh /var/backups/pe-risk
```

Mỗi đêm `backup.sh` tạo một bản `pg_dump` đã mã hoá và giữ 30 ngày. Cần sao chép thư mục sao lưu ra **ngoài máy chủ**
(object storage hoặc ổ của bệnh viện), vì máy chủ hỏng thì bản sao lưu trên chính máy đó cũng mất. Lệnh khôi phục nằm ở
cuối `backup.sh`. Nên thử khôi phục mỗi tháng một lần.

## Cập nhật phiên bản mới

```bash
cd /opt/pe-risk && git pull
cd deploy/cloud && docker compose up -d --build     # thay đổi cấu trúc dữ liệu chạy tự động
```

Luôn sao lưu trước khi cập nhật.

## Quên mật khẩu quản trị

```bash
docker compose exec app python -m pe_api.users reset-password truongkhoa
docker compose exec app python -m pe_api.users list
```

## Kiểm tra hoạt động

`https://<tên miền>/api/health` trả về `{"status":"ok"}`. Nên dùng dịch vụ giám sát của nhà cung cấp cloud để báo khi
địa chỉ này lỗi, hoặc khi ổ đĩa đầy quá 80%.
