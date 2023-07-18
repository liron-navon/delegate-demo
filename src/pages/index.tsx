import { MetaMaskSDK, SDKProvider } from "@metamask/sdk";
import { BrowserProvider, Contract, getBigInt } from "ethers";
import { useMountedState } from "react-use";
import { useCallback, useEffect, useState } from "react";
import { DelegateCash } from "delegatecash";
import { nftContractAbi } from "@/utils/nftContract";

interface Delegation {
  type: "NONE" | "ALL" | "CONTRACT" | "TOKEN";
  vault: string;
  delegate: string;
  contract: string;
  tokenId: number;
}

interface Owner {
  message: string;
  delegate?: Delegation;
}

export default function Home() {
  const isMounted = useMountedState();
  const [provider, setProvider] = useState<BrowserProvider>();
  const [account, setAccount] = useState<string>();
  const [errorMessage, setErrorMessage] = useState<string>();
  const [delegations, setDelegations] = useState<Delegation[]>([]);
  const [nftOwner, setNftOwner] = useState<Owner>();
  const [metamaskProvider, setMetamaskProvider] = useState<SDKProvider>();

  const m = () => typeof window !== "undefined" && isMounted();

  const acc1 = "0x1E3D900D674e9EBfD68a24DBf4E7576d4b48A83b";
  const acc2 = "0x0855291Ed60179BF995536180E8623bd4F1D53FA"; // 0x0855291Ed60179BF995536180E8623bd4F1D53FA
  const contract = "0xb47e3cd837ddf8e4c57f05d70ab865de6e193bbb"; // crypto punks
  const contract2 = "0xb95F1189E08513E6c38b442e84EbA63DAB673eE0"; // nft giveaway

  const figureOutOwnership = async (
    original: string,
    dels: Delegation[],
    p: BrowserProvider
  ) => {
    const contractMatch = (del: Delegation) =>
      del.contract.toLowerCase() === contract2.toLowerCase();

    const contract = new Contract(contract2, nftContractAbi, p);

    const nTokens = getBigInt(await contract.balanceOf(original));
    if (nTokens > 0) {
      setNftOwner({
        message: `Original owns ${nTokens} tokens (direct)`,
        delegate: undefined,
      });
      return;
    }

    for (const del of dels) {
      if (
        del.type === "ALL" ||
        (del.type === "CONTRACT" && contractMatch(del))
      ) {
        const nTokens = getBigInt(await contract.balanceOf(del.vault));
        if (nTokens > 0) {
          setNftOwner({
            message: `Vault owns ${nTokens} tokens (by delegation)`,
            delegate: del,
          });
          return;
        }
      } else if (del.type === "TOKEN" && contractMatch(del)) {
        const owner = await contract.ownerOf(del.tokenId);
        if (owner.toLowerCase() === del.vault.toLowerCase()) {
          setNftOwner({
            message: `vault owns token ${del.tokenId} (by delegation)`,
            delegate: del,
          });
          return;
        }
      }
    }

    setNftOwner({
      message: `none of the ${dels.length} delegations owns any tokens`,
    });
  };
  const fetchDelegations = useCallback(
    async (walletAddress: string, p: BrowserProvider) => {
      const dc = new DelegateCash();
      const dels = await dc.getDelegationsByDelegate(walletAddress);
      console.log({
        getDelegationsByDelegate: await dc.getDelegationsByDelegate(
          walletAddress
        ),
        getDelegatesForAll: await dc.getDelegatesForAll(walletAddress),
        getContractLevelDelegations: await dc.getContractLevelDelegations(
          walletAddress
        ),
        getTokenLevelDelegations: await dc.getTokenLevelDelegations(
          walletAddress
        ),
      });
      setDelegations(dels);
      figureOutOwnership(walletAddress, dels, p);
    },
    []
  );

  const connectAndFetchDelegates = useCallback(async () => {
    try {
      const MMSDK = new MetaMaskSDK({
        dappMetadata: {
          name: "hello my app",
          url: window.location.host,
        },
      });

      const ethereum = MMSDK.getProvider();

      const p = new BrowserProvider(ethereum!);
      setProvider(p);

      const accounts = await p.send("eth_requestAccounts", []);
      const account = accounts[0] as string;
      setAccount(account);
      fetchDelegations(account, p);
      setMetamaskProvider(ethereum);
    } catch (err) {
      console.error(err);
      setErrorMessage((err as Error).message);
    }
  }, [fetchDelegations]);

  useEffect(() => {
    if (!metamaskProvider) {
      return () => {};
    }

    metamaskProvider.on("accountsChanged", connectAndFetchDelegates);
    return () => {
      metamaskProvider.removeAllListeners();
    };
  }, [metamaskProvider, connectAndFetchDelegates]);

  return (
    <main className="p-24">
      <div className="mb-8">
        <div className="mb-4">
          This demo app is to test the functionality and usability of{" "}
          <a href="https://delegate.cash/">delegate.cash</a>.
        </div>
        <div>
          It checks if your wallet, or a delegate of your wallet owns a token in
          the contract {contract2}.
        </div>
      </div>
      <div>
        <button
          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-full"
          onClick={() => connectAndFetchDelegates()}
        >
          Connect metamask and fetch delegations
        </button>
      </div>
      {m() && (
        <>{errorMessage && <div className="mt-8">error: {errorMessage}</div>}</>
      )}
      {m() && (
        <>
          {account && (
            <div className="mt-8">connected as account: {account}</div>
          )}
        </>
      )}

      {m() && (
        <>
          {account && !nftOwner && (
            <div className="mt-8">This user owns no tokens in the contract</div>
          )}
          {nftOwner && (
            <div className="mt-8">
              <div>{nftOwner.message}</div>
            </div>
          )}
        </>
      )}

      {m() && (
        <>
          <hr className="mt-4"></hr>
          <div className="mt-4">
            {delegations.length > 0 ? "Delegations:" : "No delegations"}
          </div>
          {delegations.map((del, index) => (
            <div className="mt-4" key={index}>
              <div>type: {del.type}</div>
              <div>delegate: {del.delegate}</div>
              <div>vault (og wallet): {del.vault}</div>
              <div>contract: {del.contract}</div>
              <div>tokenId: {del.tokenId}</div>
            </div>
          ))}
        </>
      )}
    </main>
  );
}
