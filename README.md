# PSK API HUB
PrivateSky module that enables communication between nodes (files transfer, notifications, bricks, brick ledger)

## How to use
Clone repo into 'modules' folder
```bash
git clone 
```

## Configure anchoring module to use Ethereum API Adapter for domain DEMO

```json5
"endpointsConfig": {
      "anchoring": { 
                    "module": "./components/anchoring",
                    "domainStrategies": {
                        "DEMO": {
                                        "type" : "ETH",
                                        "option" : {
                                            "endpoint" : "http://localhost:3000", // endpoint to the APIAdapter which will make the requests to the blockchain network
                                        } // operation will be done directly into the Ethereum API -> jsonrpc-> network
                        }
                    }
      }
}

```
Where **DEMO** is the domain of the KeySSI, like **default**, **predefined**, **vault**, etc.