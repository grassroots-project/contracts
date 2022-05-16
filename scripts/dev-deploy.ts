import { wallet, dec, save } from "./helpers";
import { ethers, BigNumber, Contract } from "ethers";
import { formatUnits } from "@ethersproject/units"

import Nation from '../out/NATION.sol/NATION.json';
import VotingEscrow from '../out/VotingEscrow.vy/VotingEscrow.json';
import LiquidityDistributor from '../out/BoostedLiquidityDistributor.sol/BoostedLiquidityDistributor.json';
import MockERC20 from '../out/MockERC20.sol/MockERC20.json';
import MerkleDistributorV2 from '../out/MerkleDistributorV2.sol/MerkleDistributorV2.json';

const getContractFactory = (artifact: any) => {
    return new ethers.ContractFactory(artifact.abi, artifact.bytecode.object, wallet);
}

const deployContract = async ({ name, deployer, factory, args }: { name: string, deployer: ethers.Wallet, factory: ethers.ContractFactory, args: Array<any>}) => {
    console.log(`Deploying ${name}..`)
    const contract = await factory.connect(deployer).deploy(...args);
    await contract.deployed();
    console.log(`Deployed ${name} to: ${contract.address}`)
    return contract;
}

const deployNation = async () => {
    const supply: BigNumber = BigNumber.from(process.env.NATION_SUPPLY ?? dec(42069, 18));
    const Factory = getContractFactory(Nation);

    const nationToken = await deployContract({
        name: "NATION",
        deployer: wallet,
        factory: Factory,
        args: []
    });

    await nationToken.connect(wallet).mint(wallet.address, supply);
    console.log(`Minted ${formatUnits(supply, 18)} tokens to deployer address`)

    return nationToken;
}

const deployVeNation = async (nationToken: Contract) => {
    const Factory = getContractFactory(VotingEscrow);

    const veNATION = await deployContract({
        name: "veNATION",
        deployer: wallet,
        factory: Factory,
        args: [nationToken.address, "Vote-escrowed NATION", "veNATION", "veNATION_1.0.0"]
    })

    return veNATION;
}

const deployAirdropDistributor = async (nationToken: Contract, root: string) => {
    const Factory = getContractFactory(MerkleDistributorV2);
    const dropAmount = BigNumber.from(process.env.AIRDROP_AMOUNT ?? dec(314, 18));

    const airdropDistributor = await deployContract({
        name: "nationDropContract",
        deployer: wallet,
        factory: Factory,
        args: []
    })
    await airdropDistributor.setUp(wallet.address, nationToken.address, root);

    await nationToken.connect(wallet).approve(airdropDistributor.address, dropAmount);
    console.log(`Approved ${formatUnits(dropAmount, 18)} tokens for drop`);

    return airdropDistributor;
}

const deployLiquidityDistributor = async (rewardsToken: Contract, boostToken: Contract) => {
    const contractFactory = getContractFactory(LiquidityDistributor);
    const tokenFactory = getContractFactory(MockERC20);
    const supply = BigNumber.from(dec(314, 18));
    const rewards = BigNumber.from(dec(500, 18));
    const rewardsPeriod = 1196308; // 6 months of blocks approx

    const lpToken = await deployContract({
        name: "lpToken",
        deployer: wallet,
        factory: tokenFactory,
        args: ["80NATION-20WETH", "80NATION-20WETH", supply]
    })

    const distributor = await deployContract({
        name: "lpRewardsContract",
        deployer: wallet,
        factory: contractFactory,
        args: []
    })

    await distributor.connect(wallet).initialize(rewardsToken.address, lpToken.address, boostToken.address);

    const provider = new ethers.providers.JsonRpcProvider(process.env.RPC_URL);
    const blockNumber = await provider.getBlockNumber();
    // Setup rewards
    await rewardsToken.connect(wallet).mint(distributor.address, rewards);
    const startBlock = blockNumber + 5;
    const endBlock = startBlock + rewardsPeriod;

    await distributor.connect(wallet).setRewards(rewards, startBlock, endBlock);
    console.log(`Set ${formatUnits(rewards, 18)} NATIONs as rewards from block ${startBlock} to ${endBlock}`)

    return { "lpToken": lpToken, "lpRewardsContract": distributor}
}

const main = async () => {
    console.log(`Using deployer: ${wallet.address}`);

    const NATION = await deployNation();
    const veNATION = await deployVeNation(NATION);
    const lpContracts = await deployLiquidityDistributor(NATION, veNATION);
    const nationDropA = await deployAirdropDistributor(NATION, "0xed145aa219b18aa3f2dc56afb2c4e0b148e429ca93b9c5f2c7a29d2101685aee");
    const nationDropB = await deployAirdropDistributor(NATION, "0xb8d662135979ae3791167c967cba4bf6fb681c665d0c03372745c483fe5089f8");

    const deployment = {
        "nationToken": NATION.address,
        "veNationToken": veNATION.address,
        "balancerLPToken": lpContracts.lpToken.address,
        "lpRewardsContract": lpContracts.lpRewardsContract.address,
        "nationDropContracts": [nationDropA.address, nationDropB.address],
    }

    const manifestFile = "./deployments/local.json";
    save(deployment, manifestFile);

    console.log(`Deployment manifest saved to ${manifestFile}`)
}


main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});