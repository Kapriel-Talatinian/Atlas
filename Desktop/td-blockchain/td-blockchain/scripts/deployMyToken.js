// scripts/deployMyToken.js
const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deployer address:", deployer.address);

  const initialSupply = 1000; // supply de base (sera * 10^decimals dans le constructor)

  const MyToken = await ethers.getContractFactory("MyToken");
  const myToken = await MyToken.deploy(initialSupply);

  await myToken.waitForDeployment();
  const tokenAddress = await myToken.getAddress();
  console.log("MyToken deployed to:", tokenAddress);

  const balance = await myToken.balanceOf(deployer.address);
  console.log("Deployer token balance:", balance.toString());
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
