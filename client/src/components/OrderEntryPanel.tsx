import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Keyboard, AlertTriangle } from "lucide-react";
import { useTradingMode } from "@/contexts/TradingModeContext";
import { apiRequest } from "@/lib/queryClient";
import { toast } from "@/components/ui/use-toast";

export function OrderEntryPanel() {
  const { mode, isRealMoney, isPaperTrading } = useTradingMode();
  const [orderType, setOrderType] = useState<"market" | "limit" | "stop">("market");
  const [amount, setAmount] = useState("");
  const [price, setPrice] = useState("");
  const [percentage, setPercentage] = useState([0]);
  const [exchange, setExchange] = useState<string>("");
  const [mfaToken, setMfaToken] = useState<string>("");
  const [availableExchanges, setAvailableExchanges] = useState<Array<{exchange: string, label: string}>>([]);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingOrder, setPendingOrder] = useState<{ side: "buy" | "sell"; amount: string; price: string; exchange?: string; mfaToken?: string } | null>(null);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const amountInputRef = useRef<HTMLInputElement>(null);
  const priceInputRef = useRef<HTMLInputElement>(null);

  const handlePercentage = (value: number) => {
    setPercentage([value]);
    console.log(`Setting ${value}% of available balance`);
  };

  // Load available exchanges on mount
  useEffect(() => {
    const loadExchanges = async () => {
      if (isRealMoney) {
        try {
          const keys = await apiRequest<Array<{exchange: string, label: string | null}>>("/api/exchange-keys", {
            method: "GET",
          });
          const validated = keys.filter(k => k).map(k => ({
            exchange: k.exchange,
            label: k.label || k.exchange.charAt(0).toUpperCase() + k.exchange.slice(1)
          }));
          setAvailableExchanges(validated);
          if (validated.length > 0 && !exchange) {
            setExchange(validated[0].exchange);
          }
        } catch (error) {
          console.error("Failed to load exchanges:", error);
        }
      }
    };
    loadExchanges();
  }, [isRealMoney, exchange]);

  const handleOrder = async (side: "buy" | "sell") => {
    // Validate inputs
    if (!amount || parseFloat(amount) <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid amount",
        variant: "destructive",
      });
      return;
    }

    if (orderType === "limit" && (!price || parseFloat(price) <= 0)) {
      toast({
        title: "Invalid Price",
        description: "Please enter a valid price for limit orders",
        variant: "destructive",
      });
      return;
    }

    // If real money, validate exchange is selected
    if (isRealMoney && !exchange && availableExchanges.length > 0) {
      toast({
        title: "Exchange Required",
        description: "Please select an exchange for real money trading",
        variant: "destructive",
      });
      return;
    }

    // If real money, show confirmation dialog
    if (isRealMoney) {
      setPendingOrder({ side, amount, price, exchange, mfaToken });
      setShowConfirmDialog(true);
      return;
    }

    // Paper trading - execute immediately
    await executeOrder(side, amount, price);
  };

  const executeOrder = async (side: "buy" | "sell", orderAmount: string, orderPrice: string, orderExchange?: string, orderMfaToken?: string) => {
    setIsPlacingOrder(true);
    try {
      const response = await apiRequest("/api/trades", {
        method: "POST",
        body: {
          pair: "BTC/USD", // TODO: Get from context
          side,
          type: orderType,
          amount: parseFloat(orderAmount),
          price: orderPrice ? parseFloat(orderPrice) : null,
          mode: mode,
          exchange: orderExchange || exchange || undefined,
          mfa_token: orderMfaToken || mfaToken || undefined,
        },
      });

      toast({
        title: "Order Placed",
        description: `${side.toUpperCase()} order placed successfully`,
      });

      // Reset form
      setAmount("");
      setPrice("");
      setPercentage([0]);
    } catch (error: any) {
      toast({
        title: "Order Failed",
        description: error.message || "Failed to place order",
        variant: "destructive",
      });
    } finally {
      setIsPlacingOrder(false);
      setShowConfirmDialog(false);
      setPendingOrder(null);
    }
  };

  const handleConfirmOrder = async () => {
    if (!pendingOrder) return;
    await executeOrder(pendingOrder.side, pendingOrder.amount, pendingOrder.price, pendingOrder.exchange, pendingOrder.mfaToken);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Only handle shortcuts when input fields are not focused
      if (document.activeElement?.tagName === "INPUT") return;

      // Buy: B key
      if (e.key === "b" || e.key === "B") {
        e.preventDefault();
        handleOrder("buy");
      }
      // Sell: S key
      if (e.key === "s" || e.key === "S") {
        e.preventDefault();
        handleOrder("sell");
      }
      // Focus amount: A key
      if (e.key === "a" || e.key === "A") {
        e.preventDefault();
        amountInputRef.current?.focus();
      }
      // Focus price: P key
      if (e.key === "p" || e.key === "P") {
        e.preventDefault();
        priceInputRef.current?.focus();
      }
      // Market order: M key
      if (e.key === "m" || e.key === "M") {
        e.preventDefault();
        setOrderType("market");
      }
      // Limit order: L key
      if (e.key === "l" || e.key === "L") {
        e.preventDefault();
        setOrderType("limit");
      }
      // Stop order: T key
      if (e.key === "t" || e.key === "T") {
        e.preventDefault();
        setOrderType("stop");
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [amount, price, orderType]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Quick Trade Widget</CardTitle>
            <CardDescription>One-click trading with keyboard shortcuts</CardDescription>
          </div>
          <Badge variant="outline" className="text-xs">
            <Keyboard className="h-3 w-3 mr-1" />
            Shortcuts
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs value={orderType} onValueChange={(v) => setOrderType(v as any)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="market" data-testid="button-order-market">Market</TabsTrigger>
            <TabsTrigger value="limit" data-testid="button-order-limit">Limit</TabsTrigger>
            <TabsTrigger value="stop" data-testid="button-order-stop">Stop-Loss</TabsTrigger>
          </TabsList>
        </Tabs>

        {orderType === "limit" && (
          <div className="space-y-2">
            <Label htmlFor="price">Price</Label>
            <Input
              ref={priceInputRef}
              id="price"
              type="number"
              placeholder="0.00"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="font-mono"
              data-testid="input-price"
            />
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="amount">Amount</Label>
          <Input
            ref={amountInputRef}
            id="amount"
            type="number"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="font-mono"
            data-testid="input-amount"
          />
        </div>

        {isRealMoney && availableExchanges.length > 0 && (
          <div className="space-y-2">
            <Label htmlFor="exchange">Exchange</Label>
            <Select value={exchange} onValueChange={setExchange}>
              <SelectTrigger id="exchange">
                <SelectValue placeholder="Select Exchange" />
              </SelectTrigger>
              <SelectContent>
                {availableExchanges.map((ex) => (
                  <SelectItem key={ex.exchange} value={ex.exchange}>
                    {ex.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {isRealMoney && (
          <div className="space-y-2">
            <Label htmlFor="mfa-token" className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              2FA Token (Optional)
            </Label>
            <Input
              id="mfa-token"
              type="text"
              placeholder="Enter 2FA token"
              value={mfaToken}
              onChange={(e) => setMfaToken(e.target.value)}
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground">
              Required if 2FA is enabled on your account
            </p>
          </div>
        )}

        <div className="space-y-3">
          <Label>Quick Amount</Label>
          <div className="grid grid-cols-4 gap-2">
            {[25, 50, 75, 100].map((pct) => (
              <Button
                key={pct}
                variant="outline"
                size="sm"
                onClick={() => handlePercentage(pct)}
                data-testid={`button-percentage-${pct}`}
              >
                {pct}%
              </Button>
            ))}
          </div>
          <Slider
            value={percentage}
            onValueChange={setPercentage}
            max={100}
            step={1}
            className="mt-2"
          />
        </div>

        <div className="pt-2 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Available:</span>
            <span className="font-mono font-semibold">$10,500</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Total:</span>
            <span className="font-mono font-semibold">
              ${amount ? (parseFloat(amount) * (price ? parseFloat(price) : 47350)).toLocaleString() : "0.00"}
            </span>
          </div>
        </div>

        {/* Confirmation Dialog for Real Money Trades */}
        <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-500" />
                Confirm {isRealMoney ? "Real Money" : "Paper"} Trade
              </AlertDialogTitle>
              <AlertDialogDescription className="space-y-4">
                {isRealMoney && (
                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                    <p className="font-semibold text-red-900 dark:text-red-200 mb-2">
                      ⚠️ WARNING: This is a REAL MONEY trade
                    </p>
                    <p className="text-sm text-red-800 dark:text-red-300">
                      This order will be executed using your actual funds on connected exchanges.
                      You could lose money if the trade goes against you.
                    </p>
                  </div>
                )}
                {pendingOrder && (
                  <div className="space-y-2">
                    <p><strong>Side:</strong> {pendingOrder.side.toUpperCase()}</p>
                    <p><strong>Type:</strong> {orderType.toUpperCase()}</p>
                    <p><strong>Amount:</strong> {pendingOrder.amount}</p>
                    {pendingOrder.price && <p><strong>Price:</strong> {pendingOrder.price}</p>}
                    {pendingOrder.exchange && <p><strong>Exchange:</strong> {pendingOrder.exchange.toUpperCase()}</p>}
                    <p><strong>Mode:</strong> {isRealMoney ? "Real Money" : "Paper Trading"}</p>
                  </div>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleConfirmOrder}
                disabled={isPlacingOrder}
                className={isRealMoney ? "bg-red-500 hover:bg-red-600 text-white" : ""}
              >
                {isPlacingOrder ? "Placing..." : "Confirm Order"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <div className="grid grid-cols-2 gap-3 pt-2">
          <Button
            className="bg-trading-buy hover:bg-trading-buy-hover text-white"
            onClick={() => handleOrder("buy")}
            disabled={isPlacingOrder}
            data-testid="button-buy"
          >
            {isPlacingOrder ? "Placing..." : "Buy"} <span className="ml-2 text-xs opacity-70">(B)</span>
          </Button>
          <Button
            className="bg-trading-sell hover:bg-trading-sell-hover text-white"
            onClick={() => handleOrder("sell")}
            disabled={isPlacingOrder}
            data-testid="button-sell"
          >
            {isPlacingOrder ? "Placing..." : "Sell"} <span className="ml-2 text-xs opacity-70">(S)</span>
          </Button>
        </div>

        {isRealMoney && (
          <div className="pt-2">
            <Badge variant="destructive" className="w-full justify-center">
              <AlertTriangle className="h-3 w-3 mr-1" />
              Real Money Trading Enabled
            </Badge>
          </div>
        )}

        {/* Keyboard Shortcuts Help */}
        <div className="pt-4 border-t space-y-1 text-xs text-muted-foreground">
          <div className="font-semibold mb-2">Keyboard Shortcuts:</div>
          <div className="grid grid-cols-2 gap-1">
            <div>B - Buy</div>
            <div>S - Sell</div>
            <div>A - Focus Amount</div>
            <div>P - Focus Price</div>
            <div>M - Market Order</div>
            <div>L - Limit Order</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
