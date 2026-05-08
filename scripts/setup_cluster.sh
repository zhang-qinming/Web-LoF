#!/bin/bash
# ============================================================
# GWAS Data Browser — Linux 集群环境初始化脚本
# 用法：bash scripts/setup_cluster.sh
# ============================================================
set -e

echo "=== 1. 创建 Node.js conda 环境 ==="
conda create -n gwas-browser -y nodejs=22 npm

echo ""
echo "=== 2. 激活环境并安装依赖 ==="
source "$(conda info --base)/etc/profile.d/conda.sh"
conda activate gwas-browser

cd "$(dirname "$0")/.."

echo "安装后端依赖..."
cd backend
npm install

echo ""
echo "安装前端依赖..."
cd ../frontend
npm install

echo ""
echo "=== 3. 配置环境变量 ==="
cd ../backend
if [ ! -f .env ]; then
    echo "从 .env.linux.example 创建 backend/.env..."
    cp .env.linux.example .env
    echo "请编辑 backend/.env 修改数据库密码："
    cat .env
else
    echo "backend/.env 已存在，跳过"
fi

cd ../frontend
if [ ! -f .env ]; then
    echo "从 .env.linux.example 创建 frontend/.env..."
    cp .env.linux.example .env
else
    echo "frontend/.env 已存在，跳过"
fi

echo ""
echo "=== 4. 执行数据库 Schema 迁移 ==="
cd ../backend
node scripts/migrate.js

echo ""
echo "=== 设置完成 ==="
echo ""
echo "启动方式："
echo "  终端1: cd backend  && source activate gwas-browser && npm run dev"
echo "  终端2: cd frontend && source activate gwas-browser && npm run dev"
echo ""
echo "本地访问（SSH 隧道）："
echo "  ssh -N -L 5173:localhost:5173 -L 4000:localhost:4000 qinminzhang@101.76.96.10"
echo "  然后浏览器打开 http://localhost:5173"
