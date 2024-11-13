# sample-aa

Account Abstractionの動作理解のために作成

## 手順

### Rundlerの構築

必要に応じてRustをアップデートする（1.81以上が求められる）

```bash
rustup update
```

```bash
cd rundler
git submodule update --init --recursive
make build 
```

## 参考

* [Account Abstraction (ERC-4337) に触れてみよう ＜前編＞](https://gaiax-blockchain.com/erc4337-handson-1)