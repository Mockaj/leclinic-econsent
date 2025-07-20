'use client'

import { useState } from 'react'
import { DashboardLayout } from '@/components/dashboard-layout'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { TemplatesTab } from '@/components/templates-tab'
import { CompletedConsentsTab } from '@/components/completed-consents-tab'

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState<'templates' | 'completed'>('templates')

  return (
    <DashboardLayout activeTab={activeTab}>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Přehled</h1>
          <p className="text-muted-foreground">
            Správa šablon souhlasů a vyplněných formulářů
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'templates' | 'completed')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="templates">Šablony souhlasů</TabsTrigger>
            <TabsTrigger value="completed">Vyplněné souhlasy</TabsTrigger>
          </TabsList>
          
          <TabsContent value="templates" className="space-y-4">
            <TemplatesTab />
          </TabsContent>
          
          <TabsContent value="completed" className="space-y-4">
            <CompletedConsentsTab />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  )
}
