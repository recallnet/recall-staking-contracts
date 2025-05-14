import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";

describe("Unit-tests for the Test contract", () => {
    it("Deploy test", async () => {
        const env = await loadFixture(prepareEnv);

        expect(await env.testContract.x()).to.equal(1);
    });
});

async function prepareEnv() {
    const [deployer] = await ethers.getSigners();

    const testFactory = await ethers.getContractFactory("Test");
    const testContract = await testFactory.deploy();

    return {
        deployer,

        testContract,
    };
}
