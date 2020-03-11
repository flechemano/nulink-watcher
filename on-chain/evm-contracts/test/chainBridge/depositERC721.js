/**
 * Copyright 2020 ChainSafe Systems
 * SPDX-License-Identifier: LGPL-3.0-only
 */

const truffleAssert = require('truffle-assertions');

const ValidatorContract = artifacts.require("Validator");
const BridgeContract = artifacts.require("Bridge");
const ERC721MintableContract = artifacts.require("ERC721Mintable");
const ERC721HandlerContract = artifacts.require("ERC721Handler");

contract('Bridge - [depositERC721]', async (accounts) => {
    // const minter = accounts[0];
    const originChainDepositerAddress = accounts[1];
    const destinationChainRecipientAddress = accounts[2];
    const destinationChainID = 0;
    const originChainTokenID = 42;
    const expectedDepositID = 1;
    const genericBytes = '0x736f796c656e745f677265656e5f69735f70656f706c65';

    let ValidatorInstance;
    let BridgeInstance;
    let OriginERC721MintableInstance;
    let OriginERC721HandlerInstance;
    let DestinationERC721MintableInstance;
    let DestinationERC721HandlerInstance;
    let expectedDepositRecord;

    beforeEach(async () => {
        ValidatorInstance = await ValidatorContract.new([], 0);
        BridgeInstance = await BridgeContract.new(ValidatorInstance.address, 0);
        OriginERC721MintableInstance = await ERC721MintableContract.new();
        OriginERC721HandlerInstance = await ERC721HandlerContract.new(BridgeInstance.address);
        DestinationERC721MintableInstance = await ERC721MintableContract.new();
        DestinationERC721HandlerInstance = await ERC721HandlerContract.new(BridgeInstance.address);

        await OriginERC721MintableInstance.safeMint(originChainDepositerAddress, originChainTokenID, genericBytes);
        await OriginERC721MintableInstance.approve(OriginERC721HandlerInstance.address, originChainTokenID, { from: originChainDepositerAddress });

        expectedDepositRecord = {
            _originChainTokenAddress: OriginERC721MintableInstance.address,
            _originChainHandlerAddress: OriginERC721HandlerInstance.address,
            _destinationChainID: destinationChainID,
            _destinationChainHandlerAddress: DestinationERC721HandlerInstance.address,
            _destinationRecipientAddress: destinationChainRecipientAddress,
            _tokenID: originChainTokenID,
            _data: genericBytes
        };
    });

    it("[sanity] test originChainDepositerAddress' balance", async () => {
        const originChainDepositerBalance = await OriginERC721MintableInstance.balanceOf(originChainDepositerAddress);
        assert.strictEqual(originChainDepositerBalance.toNumber(), 1);
    });

    it(`[sanity] test originChainDepositerAddress owns token with ID: ${originChainTokenID}`, async () => {
        const tokenOwner = await OriginERC721MintableInstance.ownerOf(originChainTokenID);
        assert.strictEqual(tokenOwner, originChainDepositerAddress);
    });

    it("[sanity] test OriginERC721HandlerInstance.address' allowance", async () => {
        const allowanceHolder = await OriginERC721MintableInstance.getApproved(originChainTokenID);
        assert.strictEqual(allowanceHolder, OriginERC721HandlerInstance.address);
    });

    it('ERC721 deposit can be made', async () => {
        truffleAssert.passes(await BridgeInstance.depositERC721(
            OriginERC721MintableInstance.address,
            OriginERC721HandlerInstance.address,
            destinationChainID,
            DestinationERC721HandlerInstance.address,
            destinationChainRecipientAddress,
            originChainTokenID,
            genericBytes,
            { from: originChainDepositerAddress }
        ));
    });

    it('_depositCounts should be increments from 0 to 1', async () => {
        await BridgeInstance.depositERC721(
            OriginERC721MintableInstance.address,
            OriginERC721HandlerInstance.address,
            destinationChainID,
            DestinationERC721HandlerInstance.address,
            destinationChainRecipientAddress,
            originChainTokenID,
            genericBytes,
            { from: originChainDepositerAddress }
        );

        const depositCount = await BridgeInstance._depositCounts.call(destinationChainID);
        assert.strictEqual(depositCount.toNumber(), expectedDepositID);
    });

    it('getDepositCounts should return correct expectedDepositID', async () => {
        await BridgeInstance.depositERC721(
            OriginERC721MintableInstance.address,
            OriginERC721HandlerInstance.address,
            destinationChainID,
            DestinationERC721HandlerInstance.address,
            destinationChainRecipientAddress,
            originChainTokenID,
            genericBytes,
            { from: originChainDepositerAddress }
        );

        const depositCount = await BridgeInstance.getDepositCount(destinationChainID);
        assert.strictEqual(depositCount.toNumber(), expectedDepositID);
    });

    it('ERC721 can be deposited with correct owner and balances', async () => {
        await BridgeInstance.depositERC721(
            OriginERC721MintableInstance.address,
            OriginERC721HandlerInstance.address,
            destinationChainID,
            DestinationERC721HandlerInstance.address,
            destinationChainRecipientAddress,
            originChainTokenID,
            genericBytes,
            { from: originChainDepositerAddress }
        );

        const tokenOwner = await OriginERC721MintableInstance.ownerOf(originChainTokenID);
        assert.strictEqual(tokenOwner, OriginERC721HandlerInstance.address);

        const originChainDepositerBalance = await OriginERC721MintableInstance.balanceOf(originChainDepositerAddress);
        assert.strictEqual(originChainDepositerBalance.toNumber(), 0);

        const originChainHandlerBalance = await OriginERC721MintableInstance.balanceOf(OriginERC721HandlerInstance.address);
        assert.strictEqual(originChainHandlerBalance.toNumber(), 1);
    });

    it('ERC721 deposit record is created with expected depositID and values', async () => {
        await BridgeInstance.depositERC721(
            OriginERC721MintableInstance.address,
            OriginERC721HandlerInstance.address,
            destinationChainID,
            DestinationERC721HandlerInstance.address,
            destinationChainRecipientAddress,
            originChainTokenID,
            genericBytes,
            { from: originChainDepositerAddress }
        );

        const depositRecord = await BridgeInstance._erc721DepositRecords.call(destinationChainID, expectedDepositID);
        for (const expectedProperty of Object.keys(expectedDepositRecord)) {
            // Testing all expected object properties
            assert.property(depositRecord, expectedProperty, `property: ${expectedProperty} does not exist in depositRecord`);

            // Testing all expected object values
            const depositRecordValue = depositRecord[expectedProperty].toNumber !== undefined ?
                depositRecord[expectedProperty].toNumber() : depositRecord[expectedProperty];
            assert.strictEqual(
                depositRecordValue, expectedDepositRecord[expectedProperty],
                `property: ${expectedProperty}'s value: ${depositRecordValue} does not match expected value: ${expectedDepositRecord[expectedProperty]}`)
        }
    });

    it('ERC721Deposited event is fired with expected value', async () => {
        const depositTx = await BridgeInstance.depositERC721(
            OriginERC721MintableInstance.address,
            OriginERC721HandlerInstance.address,
            destinationChainID,
            DestinationERC721HandlerInstance.address,
            destinationChainRecipientAddress,
            originChainTokenID,
            genericBytes,
            { from: originChainDepositerAddress }
        );

        truffleAssert.eventEmitted(depositTx, 'ERC721Deposited', (event) => {
            return event.depositID.toNumber() === expectedDepositID
        });
    });

    it('getERC721DepositRecord should return correct depositID with values in expected order', async () => {
        await BridgeInstance.depositERC721(
            OriginERC721MintableInstance.address,
            OriginERC721HandlerInstance.address,
            destinationChainID,
            DestinationERC721HandlerInstance.address,
            destinationChainRecipientAddress,
            originChainTokenID,
            genericBytes,
            { from: originChainDepositerAddress }
        );

        const depositRecord = await BridgeInstance.getERC721DepositRecord(destinationChainID, expectedDepositID);
        const depositRecordValues = Object.values(depositRecord);
        depositRecordValues.forEach((depositRecordValue, index) => {
            depositRecordValues[index] = depositRecordValue.toNumber !== undefined ?
                depositRecordValue.toNumber() : depositRecordValue;
        });
        assert.sameOrderedMembers(depositRecordValues, Object.values(expectedDepositRecord));
    });
});