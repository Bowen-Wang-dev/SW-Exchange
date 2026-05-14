# SW Exchange v0.x 需求说明书

## 1. 项目定位

SW Exchange v0.x 是一个轻量级虚拟资产模拟交易所，用于朋友和公开测试用户体验内部转账、模拟现货交易、空气币价格波动和平台内虚拟经济玩法。

v0.x 阶段不接入真实链上充值和提现，不处理真实法币，不承诺任何资产具有真实价值。

系统内资产仅用于测试、娱乐和技术演示，不代表真实货币价值，不承诺兑换真实法币，不构成投资产品。

## 2. 当前版本核心目标

v0.x 的核心目标是先完成一个内部记账准确、用户体验完整、能进行 SWL/SWC 现货交易的中心化模拟交易平台。

一句话目标：

> 先做一个不会算错账的内部模拟交易所，v1.x 再接 BSC 链上充提。

## 3. 版本边界

### 3.1 v0.x 做什么

v0.x 只做内部系统：

1. 公开注册 / 登录
2. 用户内部钱包
3. 管理员空投 SWC / SWL
4. 用户之间内部转账
5. SWL/SWC 限价现货交易
6. 订单簿
7. 成交记录
8. 订单记录
9. 账本流水
10. 手续费系统
11. 管理后台

### 3.2 v0.x 不做什么

v0.x 暂不做：

1. 链上充值 deposit
2. 链上提现 withdraw
3. BSC 地址生成
4. BSC Transfer 监听
5. 提现审核
6. 提现广播
7. K 线图
8. 市价单
9. 合约 / 杠杆
10. 法币充值 / 法币提现
11. KYC

### 3.3 v1.x 再做什么

v1.x 可以再加入：

1. BSC / BNB Smart Chain 接入
2. 链上充值 deposit
3. 链上提现 withdraw
4. 用户充值地址
5. 链上交易监听
6. 提现审核和广播
7. K 线图
8. 市价单
9. 更多交易对

## 4. 资产设计

### 4.1 SW Cash / SWC

定位：平台内结算资产和计价单位。

正式表述：

> SW Cash 是平台内模拟计价单位，参考港币进行显示和记账，但不承诺真实兑换港币，不代表真实稳定币。

用途：

* 用户入场模拟资金
* 买入 SW LUNA
* 卖出 SW LUNA 后获得 SWC
* 手续费结算
* 排行榜和资产净值展示

不要使用以下高风险表述：

* 真实 1:1 锚定港币
* 可兑换港币
* 稳定币
* 保值
* 储备支持

可以使用：

* 参考港币计价
* 模拟结算单位
* 游戏内计价单位
* 不可兑换真实法币

### 4.2 SW LUNA / SWL

定位：平台内波动型空气币。

用途：

* 用于 SWL/SWC 现货交易
* 用于模拟涨跌
* 用于朋友之间炒着玩
* 可由管理员初始发行或空投
* 价格由用户交易形成，或早期由管理员做市

### 4.3 BNB

v0.x 不做 BNB。

BNB 仅在 v1.x 链上充提阶段考虑，用于 BSC gas。

## 5. 用户系统需求

### 5.1 注册方式

v0.x 使用公开注册。

用户可以通过邮箱 / 用户名 / 密码注册账号。

建议字段：

* email
* username
* password
* nickname

### 5.2 登录方式

支持：

* 邮箱或用户名登录
* 密码登录
* JWT 登录态

### 5.3 用户状态

用户状态包括：

* ACTIVE：正常
* BANNED：封禁，不能登录或操作
* FROZEN：冻结，能登录但不能交易 / 转账

### 5.4 KYC

v0.x 无 KYC。

由于 v0.x 不接链上充提、不接法币、不承诺真实价值，因此先作为纯模拟系统处理。

## 6. 钱包与账本需求

### 6.1 内部钱包

每个用户对每个资产都有内部钱包余额。

每个余额分为：

* available_balance：可用余额
* locked_balance：冻结余额

冻结余额用于：

* 挂单冻结
* 风控冻结
* 未来提现冻结

### 6.2 账本流水

所有资产变化都必须生成 ledger entry。

流水类型包括：

* AIRDROP：管理员空投
* TRANSFER_IN：内部转账收入
* TRANSFER_OUT：内部转账支出
* ORDER_LOCK：挂单冻结
* ORDER_UNLOCK：撤单 / 未成交部分解冻
* TRADE_BUY：买入到账
* TRADE_SELL：卖出到账
* FEE：手续费扣除
* ADMIN_ADJUST：管理员调整

v0.x 不需要：

* DEPOSIT
* WITHDRAW_REQUEST
* WITHDRAW_SUCCESS
* WITHDRAW_CANCEL

这些留到 v1.x。

### 6.3 余额原则

任何时候：

* available_balance >= 0
* locked_balance >= 0

余额不能随便直接改。

所有余额变化必须：

* 有业务原因
* 有流水记录
* 有关联对象，例如 order_id、trade_id、transfer_id
* 在数据库事务内完成

## 7. 内部转账需求

### 7.1 用户之间转账

用户可以把 SWC 或 SWL 转给另一个用户。

转账方式 v0.x 支持：

* 输入对方 username
* 或输入对方 email

### 7.2 转账手续费

内部转账完全免费。

不收平台手续费。

### 7.3 转账状态

内部转账即时完成。

状态：

* SUCCESS
* FAILED

失败原因：

* 接收方不存在
* 余额不足
* 用户被冻结
* 资产暂停转账
* 金额不合法

## 8. 现货交易需求

### 8.1 交易对

v0.x 只支持一个交易对：

* SWL/SWC

含义：

* 用 SWC 买 SWL
* 卖 SWL 得到 SWC

### 8.2 订单类型

v0.x 只支持：

* 限价买单 LIMIT BUY
* 限价卖单 LIMIT SELL
* 撤单 CANCEL ORDER

v0.x 暂不支持：

* 市价单 MARKET ORDER
* 止盈止损
* 杠杆
* 合约

v1.x 可以加入市价单。

### 8.3 挂单规则

买单：

* 用户输入买入价格 price 和数量 amount。
* 系统计算需要冻结的 SWC。
* 冻结金额 = price × amount。

卖单：

* 用户输入卖出价格 price 和数量 amount。
* 系统冻结 amount 数量的 SWL。

### 8.4 撮合规则

使用价格优先、时间优先：

* 买单可以吃掉价格小于等于买价的卖单。
* 卖单可以吃掉价格大于等于卖价的买单。
* 同价格下，先挂单的订单优先成交。

成交价格采用 maker price，也就是老挂单价格。

### 8.5 订单状态

订单状态包括：

* OPEN：挂单中
* PARTIAL_FILLED：部分成交
* FILLED：完全成交
* CANCELLED：已取消
* REJECTED：被拒绝

### 8.6 成交记录

每次撮合成功生成 trade 记录。

trade 包含：

* market
* price
* amount
* buyer_id
* seller_id
* buy_order_id
* sell_order_id
* buyer_fee
* seller_fee
* created_at

## 9. 手续费系统需求

### 9.1 交易手续费

v0.x 交易手续费：

* 买卖双方统一 0.1%
* 不区分 maker / taker

手续费规则：

* 买方手续费：从买到的 SWL 中扣除 0.1%
* 卖方手续费：从卖出得到的 SWC 中扣除 0.1%

例子：

成交：100 SWL @ 2 SWC

买方：

* 应得 100 SWL
* 手续费 0.1 SWL
* 实际到账 99.9 SWL

卖方：

* 应得 200 SWC
* 手续费 0.2 SWC
* 实际到账 199.8 SWC

### 9.2 手续费归集

手续费进入平台系统账户。

系统账户建议包括：

* FEE_ACCOUNT：手续费账户
* AIRDROP_ACCOUNT：空投账户
* TREASURY_ACCOUNT：平台金库账户

系统账户不能像普通用户一样登录。

## 10. 页面需求

### 10.1 普通用户页面

v0.x 需要：

1. 注册页
2. 登录页
3. Dashboard 首页
4. 钱包页
5. 内部转账页
6. 现货交易页
7. 订单簿
8. 我的当前委托
9. 我的历史订单
10. 成交记录
11. 账本流水

### 10.2 管理员页面

v0.x 需要 Admin Dashboard。

当前阶段暂设一个 admin，拥有全部权限，不做复杂 RBAC 权限系统。

管理员账号通过环境变量或 seed 脚本初始化，例如：

* ADMIN_EMAIL
* ADMIN_USERNAME
* ADMIN_PASSWORD

v0.x 管理员页面需要：

1. 用户管理
2. 用户余额查看
3. 空投 SWC / SWL
4. 冻结 / 解冻用户
5. 资产管理
6. 订单管理
7. 成交管理
8. 手续费收入查看
9. 账本流水查看
10. 管理员操作日志

### 10.3 v0.x 不做的页面

v0.x 不做：

* 充值页
* 提现页
* K 线图
* 合约页
* 杠杆页
* 法币入金页

这些留到 v1.x 或更后面。

## 11. 管理后台需求

管理员需要支持：

* 查看用户列表
* 查看用户余额
* 给用户空投 SWC / SWL
* 冻结 / 解冻用户
* 查看订单
* 查看成交
* 查看手续费收入
* 查看账本流水
* 查看转账记录
* 管理系统资产开关
* 查看管理员操作日志

管理员操作必须记录：

* admin_id
* action
* target_type
* target_id
* before_value
* after_value
* created_at

## 12. 安全与正确性需求

v0.x 至少需要：

* 密码 hash
* JWT secret 安全配置
* 后端参数校验
* 所有金额使用 decimal 或 bigint，不用 float
* 余额更新必须使用数据库事务
* 订单撮合必须防止并发重复成交
* 撤单必须防止重复解冻
* 管理员操作必须记录审计日志
* 用户输入金额必须检查精度和最小值
* 用户不能给自己转账，或者允许但直接拒绝无意义转账

## 13. 推荐技术栈

建议：

* Frontend：Next.js / React
* Backend：NestJS
* Database：PostgreSQL
* ORM：Drizzle 或 TypeORM
* Auth：JWT
* Package Manager：pnpm
* Deploy：Docker Compose

v0.x 可以做成 monolith，不需要微服务。

推荐后端模块：

* auth
* users
* assets
* wallets
* ledger
* transfers
* markets
* orders
* trades
* admin

## 14. 推荐数据库核心表

v0.x 核心表：

* users
* assets
* wallets
* ledger_entries
* transfers
* markets
* orders
* trades
* system_accounts
* admin_audit_logs

v1.x 再加：

* deposit_addresses
* deposits
* withdrawals
* chain_transactions

## 15. 协作方式

当前项目无 backend，可以从官方脚手架和成熟开源后台布局思路开始搭建，不需要完全从 0 手写底层结构。

允许借鉴：

* NestJS 官方项目结构
* Next.js 官方项目结构
* shadcn/ui 后台页面风格
* 常见 admin dashboard 布局

不建议直接复制不明来源交易所项目代码，除非确认许可证兼容并保留必要 attribution。

本项目采用以下协作模式：

* ChatGPT：负责统筹规划、需求拆分、架构设计、数据库设计、API 设计、Codex prompt、代码审查思路、调试指导。
* Codex：负责根据明确任务写具体代码。
* 用户：负责运行代码、查看结果、反馈报错、决定产品方向。

每一轮开发应该按以下流程：

1. 先确定本轮目标。
2. ChatGPT 输出任务说明和 Codex prompt。
3. Codex 写代码。
4. 用户运行。
5. 用户把报错或结果发回来。
6. ChatGPT 继续指导修复或进入下一步。

## 16. 第一阶段 MVP 范围

第一阶段只做：

1. 项目初始化
2. 数据库连接
3. 用户注册登录
4. 资产初始化：SWC / SWL
5. 用户钱包初始化
6. 管理员空投
7. 内部转账
8. 账本流水
9. 限价订单
10. 撮合成交
11. 撤单
12. 手续费扣除
13. 订单簿
14. 成交记录
15. 管理后台基础接口

## 17. 开发顺序

推荐顺序：

### Step 1：项目骨架

* NestJS 后端
* PostgreSQL
* Drizzle / TypeORM
* 基础配置
* Docker Compose

### Step 2：用户系统

* 注册
* 登录
* JWT
* 密码 hash
* 用户状态

### Step 3：资产和钱包

* assets 表
* wallets 表
* 用户注册后自动生成 SWC / SWL 钱包
* 查询余额接口

### Step 4：账本系统

* ledger_entries 表
* 所有余额变化必须写流水
* 后续转账、空投、交易都依赖 ledger

### Step 5：管理员空投

* admin 给用户发 SWC / SWL
* 增加用户余额
* 写 AIRDROP 流水
* 写 admin audit log

### Step 6：内部转账

* 用户转 SWC / SWL 给其他用户
* 免费
* 数据库事务
* 双方余额变化
* 双方 ledger
* transfer record

### Step 7：限价订单

* 创建买单
* 创建卖单
* 余额冻结
* ORDER_LOCK 流水

### Step 8：撮合引擎

* 查询可成交订单
* 按价格优先、时间优先撮合
* 生成 trade
* 扣手续费
* 更新买卖双方余额
* 更新订单状态
* 写 ledger

### Step 9：撤单

* 只能撤自己的 OPEN / PARTIAL_FILLED 订单
* 解冻剩余金额
* 更新订单状态
* 写 ORDER_UNLOCK 流水

### Step 10：前端页面

* Dashboard
* 钱包页
* 转账页
* 交易页
* 订单簿
* 成交记录
* 我的订单

## 18. 当前已确定决策

1. 注册方式：公开注册
2. SWC 表述：参考港币计价，不承诺真实兑换
3. 内部转账：完全免费
4. 交易手续费：双方统一 0.1%
5. 链上充提：v0.x 不做，v1.x 再做 BSC
6. 提现：v0.x 无提现；v1.x 如果做提现，建议管理员审核
7. 前期交易对：只做 SWL/SWC
8. K 线图：v0.x 不做，v1.x 再加
9. 订单类型：v0.x 只做限价单，v1.x 再加市价单
10. 合约：v0.x 不做
