# macOS 本地开发环境

本机使用原生 PostgreSQL 16，无需 Docker。项目位于 OneDrive 同步目录，使用 `pnpm dev:local` 避免默认文件监听卡顿。

## 已配置

- Node.js 24.15.0、pnpm 10.32.1，依赖按 `pnpm-lock.yaml` 安装。
- Homebrew PostgreSQL 16，数据目录 `/opt/homebrew/var/postgresql@16`。
- 本地开发数据库 `sw_exchange`，已执行仓库迁移和初始化数据。
- 根目录 `.env` 从 `.env.example` 生成，JWT 密钥已随机化；该文件被 Git 忽略。
- 管理员登录信息在根目录 `.env` 的 `ADMIN_EMAIL`、`ADMIN_USERNAME`、`ADMIN_PASSWORD` 中。
- 完整 smoke 会保留测试用户、资产和交易记录在本地开发库中。

## 日常启动

在项目根目录执行：

```bash
# 重启电脑后，先启动数据库；如果已在运行则跳过。
/opt/homebrew/opt/postgresql@16/bin/pg_ctl \
  -D /opt/homebrew/var/postgresql@16 \
  -l /opt/homebrew/var/postgresql@16/server.log start

pnpm dev:local
```

- 网页：http://127.0.0.1:3000
- 管理后台：http://127.0.0.1:3000/admin
- API 健康检查：http://127.0.0.1:3001/api/health

`dev:local` 为 API 使用 Node 原生 `--watch` 和 tsx TypeScript 加载器，为 Next.js 启用 `WATCHPACK_POLLING=true`。在运行开发命令的终端按 Ctrl+C 停止前后端。

需要停止数据库时：

```bash
/opt/homebrew/opt/postgresql@16/bin/pg_ctl \
  -D /opt/homebrew/var/postgresql@16 stop -m fast
```

## 安装与验证

```bash
pnpm install --frozen-lockfile --store-dir .pnpm-store

# 新库初始化，或拉取了新增迁移后执行。
pnpm db:migrate
pnpm db:seed

# 前后端运行后，在另一个终端执行完整验证。
WATCHPACK_POLLING=true pnpm smoke
```

数据库账号和密码沿用仓库 `.env.example` 的本地开发配置。当前数据库使用 Homebrew 默认的本地 trust 认证；此配置仅用于本机开发。数据库数据存放在 Homebrew 目录，未放入 OneDrive。
