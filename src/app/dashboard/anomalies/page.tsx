"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { FilePlus2, ArrowUp, ArrowDown, TrendingUp } from "lucide-react"
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts"

const anomaliesByMonth = [
    { name: "Jan", "Anomalies": 30 },
    { name: "Fév", "Anomalies": 25 },
    { name: "Mar", "Anomalies": 40 },
    { name: "Avr", "Anomalies": 35 },
    { name: "Mai", "Anomalies": 50 },
    { name: "Juin", "Anomalies": 45 },
]

const recentAnomalies = [
    { id: "CAA-2407-015", date: "2024-07-22", reporter: "Nadia Kettani", type: "Comportement dangereux", status: "Action corrective ouverte" },
    { id: "CAA-2407-014", date: "2024-07-21", reporter: "Ahmed Bennani", type: "Équipement défectueux", status: "Résolue" },
    { id: "CAA-2407-013", date: "2024-07-20", reporter: "Said Tazi", type: "Défaut de rangement", status: "Résolue" },
    { id: "CAA-2407-012", date: "2024-07-19", reporter: "Leila Alami", type: "Fuite d'huile", status: "En cours d'investigation" },
]

export default function AnomaliesPage() {
    const getStatusVariant = (status: string) => {
        switch (status) {
          case "Résolue":
            return "default"
          case "En cours d'investigation":
            return "secondary"
          case "Action corrective ouverte":
            return "outline"
          default:
            return "secondary"
        }
      }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight font-headline">Chasse aux Anomalies / اصطياد الحالات الشاذة</h1>
        <p className="text-muted-foreground">
          Tableau de bord pour le suivi et la gestion des anomalies terrain (CAA).
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Anomalies Signalées (Mois)</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">45</div>
            <p className="text-xs text-muted-foreground flex items-center">
                <ArrowUp className="h-3 w-3 mr-1 text-green-600"/> -10% vs mois dernier
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taux de Résolution</CardTitle>
             <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">82%</div>
            <p className="text-xs text-muted-foreground flex items-center">
                <ArrowUp className="h-3 w-3 mr-1 text-destructive"/> +5% vs mois dernier
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Anomalies Ouvertes</CardTitle>
             <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">18</div>
            <p className="text-xs text-muted-foreground">Dont 5 en retard</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Top Contributeur</CardTitle>
             <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Ahmed Bennani</div>
            <p className="text-xs text-muted-foreground">Avec 7 remontées ce mois</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-full lg:col-span-4">
            <CardHeader>
                <CardTitle>Rapports d'Anomalies Récents</CardTitle>
                <CardDescription>Liste des dernières remontées terrain.</CardDescription>
            </CardHeader>
            <CardContent>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>ID CAA</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Signalé par</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Statut</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {recentAnomalies.map((anomaly) => (
                        <TableRow key={anomaly.id}>
                            <TableCell className="font-medium">{anomaly.id}</TableCell>
                            <TableCell>{anomaly.date}</TableCell>
                            <TableCell>{anomaly.reporter}</TableCell>
                            <TableCell>{anomaly.type}</TableCell>
                            <TableCell><Badge variant={getStatusVariant(anomaly.status) as any}>{anomaly.status}</Badge></TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
            </CardContent>
        </Card>
        <Card className="col-span-full lg:col-span-3">
            <CardHeader>
                <CardTitle>Anomalies par Mois</CardTitle>
                <CardDescription>Nombre d'anomalies signalées au cours des 6 derniers mois.</CardDescription>
            </CardHeader>
            <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={anomaliesByMonth}>
                        <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                        <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                        <Tooltip />
                        <Bar dataKey="Anomalies" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
      </div>
        <div className="fixed bottom-8 right-8">
            <Button size="lg" className="rounded-full h-16 w-16 shadow-lg bg-accent hover:bg-accent/90">
                <FilePlus2 className="h-8 w-8" />
                <span className="sr-only">Nouvelle Anomalie</span>
            </Button>
        </div>
    </div>
  )
}
