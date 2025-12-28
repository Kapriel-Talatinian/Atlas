// scripts/deployMyNFT.js
const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deployer address:", deployer.address);

  const MyNFT = await ethers.getContractFactory("MyNFT");
  const myNft = await MyNFT.deploy();

  await myNft.waitForDeployment();
  const nftAddress = await myNft.getAddress();
  console.log("MyNFT deployed to:", nftAddress);

  // Petit test : on mint un NFT au déployeur
  const tx = await myNft.mintNFT(
    deployer.address,
    "https://example.com/mon-nft-1.json" // une URI de test
  );
  await tx.wait();

  console.log("Minted NFT #0 to deployer");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
