# 第一阶段：部署、备份与恢复

这份配置用于单实例 Linux 测试环境。仓库尚未部署到公网，也未在任何服务器安装服务或定时任务。需要提供服务器访问方式、绑定的域名以及备份存储位置后，才能执行部署。

## 本地数据库操作

在 `apps/web` 下使用 Node.js 24.9+：

```powershell
pnpm db:backup data/family.sqlite data/backups/manual-2026-10-09.sqlite
pnpm db:verify data/backups/manual-2026-10-09.sqlite
pnpm db:restore data/backups/manual-2026-10-09.sqlite data/recovered-2026-10-09.sqlite
```

- `backup` 使用 SQLite `VACUUM INTO` 取得一致性快照，允许源数据库继续运行，包含已经提交到 WAL 的数据。输出到新文件，拒绝覆盖既有文件；成功后做完整性、外键、家庭数据及管理员校验。
- `verify` 只读验证数据库，输出账号和家庭数量，不打印个人记录或凭证。
- `restore` 先生成并验证新的数据库，清除旧会话、邀请码和恢复密钥摘要，用户须重新登录并生成新恢复密钥。不会替换正在使用的数据库。
- 每次指定不同的目标文件名。备份含账号凭证摘要和所有家庭数据，不能放进静态站点或版本控制；导出的 JSON 只包含一个家庭的记录，不能恢复账号。

实际切换前先备份当前库，暂停写入、停止服务，将 `FAMILY_DB` 改为恢复后的绝对路径，再启动服务，检查 `/api/health` 和一次登录读取。旧数据库保留，可停止服务并切回原路径。不要直接用复制单个 `.sqlite` 文件的方式覆盖带 WAL 的在线数据库。

## Linux 部署模板

约定源码放在 `/opt/24years`，Node.js 安装在 `/usr/bin/node`，使用独立系统用户 `24years`。路径不同时同时修改 service 文件。构建需要 pnpm 11；运行后台无需第三方运行时依赖。

1. 使用专用用户和仅该用户可访问的数据目录 `/var/lib/24years`，准备独立备份目录 `/var/backups/24years`，权限设为 `0700`。备份目录最好位于不同磁盘，并配置受限的异地副本。
2. 在 `apps/web` 执行 `pnpm install --frozen-lockfile`、检查及 `pnpm build`。源码与构建产物由部署用户管理，服务用户只需读取权限。
3. 将 `24years.env.example` 复制到 `/etc/24years.env`，替换实际 HTTPS 地址，确认 `FAMILY_DB`、`BACKUP_DIR`；该文件仅允许 root 和服务用户读取。
4. 将三个 `24years*.service` / `.timer` 模板安装到 `/etc/systemd/system/`，执行 `systemctl daemon-reload`，再启用 `24years.service`。
5. 将 `Caddyfile.example` 中域名替换为实际域名，交由已有 Caddy 配置管理。DNS 应指向服务器，开放 80/443；8787 仅监听回环地址。Caddy 提供 HTTPS，网页和 `/api` 使用同一来源。
6. 确认 `curl --fail https://实际域名/api/health` 成功，再用两个测试账号验证建档、配对、编辑和重新登录。
7. 手动运行一次 `systemctl start 24years-backup.service`，检查新备份并恢复到临时新文件，确认可登录读取后，再启用 `systemctl enable --now 24years-backup.timer`。

如果需要迁移当前开发数据，先明确迁移哪些真实账号和档案；不要把开发目录整体上传。可用上述数据库备份工具生成一致性副本，安全传输后执行恢复流程；也可由用户使用 JSON 导入到新账号的家庭中。

## 运行检查和保留策略

### 页面更新提示

每次 `pnpm build` 会生成配套的前端版本号及 `dist/version.json`。部署时需要一起发布整个 `dist` 目录，不能只替换 JavaScript 文件。已打开的页面会在打开时、回到标签页、网络恢复及每分钟检查新版本；发现更新后显示“刷新更新”，由用户先保存内容再手动刷新。版本检查失败不会影响正常记录。

此功能首次上线时，已经打开的旧页面需要手动刷新一次才能启用。服务器为静态文件设置了 `Cache-Control: no-cache`，如另有 CDN 或反向代理缓存，请让 `index.html` 与 `version.json` 不使用长期缓存。

```sh
systemctl status 24years.service
systemctl list-timers 24years-backup.timer
journalctl -u 24years.service -n 100
journalctl -u 24years-backup.service -n 30
```

备份定时器每六小时运行一次，机器停机期间错过的任务会在恢复后补跑一次。命令返回非零表示失败，必须将服务失败和备份超时接入实际运维告警；模板本身不发送邮件或通知。健康接口检查服务及数据库连接，不代替备份恢复演练。

模板不自动删除历史备份，避免误删唯一可用副本；部署时应明确保留周期、容量告警和异地保存方式，并定期演练恢复。账号注销只处理在线数据库，不会擦除已有运维备份或已下载文件。恢复旧库可能恢复备份时仍存在的账号和记录，正式环境需要结合注销记录处理，并告知相关数据保留安排。

## 本阶段验收范围

- JSON 导入支持本机及已有同步家庭（仅管理员），预览后明确确认，导入前保留最近一次副本。恢复不会从文件修改同步家庭的成员、身份、权限或主题。
- 导入发现预览后数据变更会拒绝覆盖。响应丢失时可以重试同一份预览，操作编号保证不重复替换。
- 注册时发放一次恢复密钥；旧账号可凭当前密码生成。密钥只保存摘要、一次有效，恢复密码撤销全部旧会话，不自动登录。
- 注销需密码、账号名称和数据影响确认。唯一成员注销删除整个服务端家庭；管理员有伴侣时转交管理权；普通成员注销保留共同记录。本机记录不自动删除。
- 没有恢复密钥且忘记密码时仍无法自助恢复；邮件验证、邮件找回、离线写队列、正式监控告警与公网部署尚未完成。
