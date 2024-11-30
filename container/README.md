# RundlerのDockerイメージの管理

ECSのタスク定義から参照できるよう、ECRでRundlerのDockerイメージを管理する

## 1.Dockerイメージ管理用のEC2インスタンスを作成する

```bash
cdk deploy
```

## 2.EC2インスタンスの環境設定

```bash
apt-get update && apt-get upgrade -y
apt-get install -y libssl-dev make clang pkg-config libcurl4-openssl-dev libprotobuf-dev build-essential wget git
rm -rf /var/lib/apt/lists/*

# Goのインストール（1.18以上が必要）
wget https://go.dev/dl/go1.21.0.linux-amd64.tar.gz
sudo tar -C /usr/local -xzf go1.21.0.linux-amd64.tar.gz
echo "export PATH=$PATH:/usr/local/go/bin" >> ~/.profile
source ~/.profile
sudo apt-get update

# RustとCargoのインストール
curl https://sh.rustup.rs -sSf | sh -s -- -y
. "$HOME/.cargo/env"
rustup update
rustup toolchain add nightly --component rustfmt --profile minimal

# Dockerをインストール
wget -qO- https://get.docker.com | sh
apt install docker-compose
sudo groupadd docker
sudo usermod -aG docker $USER

# Node.jsのインストール方法は注意（実行後リロードしてセッションをクリアする）
sudo apt install -y cpu-checker nodejs npm
sudo npm install n -g
sudo n 20.18.0
sudo apt purge -y nodejs npm
sudo apt autoremove -y
```

## ※GithubのSSH設定

```bash
ssh-keygen -t ed25519 -C -f ~/.ssh/id_ed25519
cat ~/.ssh/id_ed25519
```

## Dockerイメージを作成してECRへプッシュする

```bash
sudo git clone https://github.com/atakedemo/rundler.git
cd rundler
sudo git submodule update --init --recursive

docker buildx build --platform=linux/arm64 -t rundler .

# AWS CLIのインストール
apt  install awscli 

# ECRのリポジトリへプッシュ
docker tag rundler:latest XXXXXXXXXXX.dkr.ecr.ap-northeast-1.amazonaws.com/rundler:latest
docker push XXXXXXXXXXX.dkr.ecr.ap-northeast-1.amazonaws.com/rundler:latest
```
