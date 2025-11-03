import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertCircle, TrendingUp, TrendingDown, BarChart3, Target, Shield, Zap, AlertTriangle, Activity } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import RiskManagement from "@/components/RiskManagement";

export default function RiskManagementPage() {
  return (
    <div className="container mx-auto py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-center mb-2">Risk Management</h1>
        <p className="text-center text-gray-600 mb-6">
          Monitor and manage your trading risks with advanced analytics
        </p>
      </div>

      <RiskManagement />
    </div>
  );
}
