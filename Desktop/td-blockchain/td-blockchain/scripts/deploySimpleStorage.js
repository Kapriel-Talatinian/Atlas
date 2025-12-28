// scripts/deploySimpleStorage.js
const { ethers } = require("hardhat");

async function main() {
  // 1. Récupérer la factory du contrat
  const SimpleStorage = await ethers.getContractFactory("SimpleStorage");

  // 2. Déployer
  const simpleStorage = await SimpleStorage.deploy();

  // 3. Attendre la fin du déploiement (ethers v6)
  await simpleStorage.waitForDeployment();

  const address = await simpleStorage.getAddress();
  console.log("SimpleStorage deployed to:", address);

  // 4. Appeler set(42)
  const tx = await simpleStorage.set(42);
  await tx.wait();

  // 5. Lire la valeur
  const value = await simpleStorage.get();
  console.log("Stored value:", value.toString());
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
