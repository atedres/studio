'use client'

import {
  Activity,
  AlertOctagon,
  CheckSquare,
  Grab,
  ListTodo,
  PieChart as PieChartIcon,
  Users,
} from "lucide-react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Cell
} from "recharts"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"


const participationData = [
  { name: 'Jan', Taux: 85 },
  { name: 'Fév', Taux: 92 },
  { name: 'Mar', Taux: 88 },
  { name: 'Avr', Taux: 95 },
  { name: 'Mai', Taux: 91 },
  { name: 'Juin', Taux: 98 },
];

const anomaliesData = [
  { name: 'Électrique', value: 12, fill: 'hsl(var(--chart-1))' },
  { name: 'Mécanique', value: 25, fill: 'hsl(var(--chart-2))' },
  { name: 'Chimique', value: 8, fill: 'hsl(var(--chart-3))' },
  { name: 'Ergonomique', value: 15, fill: 'hsl(var(--chart-4))' },
  { name: 'Autre', value: 5, fill: 'hsl(var(--chart-5))' },
];

const recentIncidents = [
    { id: 'INC-0123', date: '2024-07-20', type: 'Presque-accident', status: 'Enquête' },
    { id: 'INC-0122', date: '2024-07-18', type: 'Blessure mineure', status: 'Clos' },
    { id: 'INC-0121', date: '2024-07-15', type: 'Dommage matériel', status: 'En cours' },
]


export default function DashboardPage() {
  return (
    <div className="flex-1 space-y-4">
        <h1 className="text-3xl font-bold tracking-tight font-headline">Tableau de Bord / لوحة التحكم</h1>
        <p className="text-muted-foreground">
            Aperçu des indicateurs clés de performance Santé, Sécurité et Environnement.
        </p>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card className="col-span-1 lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="space-y-1">
                <CardTitle>Taux de Participation aux Dialogues / نسبة المشاركة</CardTitle>
                <CardDescription>Évolution mensuelle du taux de participation.</CardDescription>
            </div>
            <Grab className="cursor-move text-muted-foreground" />
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={participationData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis unit="%" />
                <Tooltip />
                <Bar dataKey="Taux" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="space-y-1">
                <CardTitle>Anomalies par Type / الحالات الشاذة حسب النوع</CardTitle>
                <CardDescription>Répartition des anomalies signalées.</CardDescription>
            </div>
            <Grab className="cursor-move text-muted-foreground" />
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={anomaliesData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                    {anomaliesData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.fill} />)}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 col-span-1 lg:col-span-3 gap-6">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Actions en Retard</CardTitle>
                    <AlertOctagon className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold text-destructive">12</div>
                    <p className="text-xs text-muted-foreground">Actions correctives non clôturées</p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Audits Réalisés</CardTitle>
                    <CheckSquare className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">178</div>
                    <p className="text-xs text-muted-foreground">+25 ce mois-ci</p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Taux de Respect Planning</CardTitle>
                    <Activity className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">94%</div>
                    <p className="text-xs text-muted-foreground">Basé sur les audits planifiés</p>
                </CardContent>
            </Card>
        </div>


        <Card className="col-span-1 lg:col-span-3 xl:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="space-y-1">
                <CardTitle>Incidents Récents / الحوادث الأخيرة</CardTitle>
                <CardDescription>Liste des derniers incidents et leur statut.</CardDescription>
            </div>
            <Grab className="cursor-move text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>ID</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Statut</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {recentIncidents.map((incident) => (
                         <TableRow key={incident.id}>
                            <TableCell className="font-medium">{incident.id}</TableCell>
                            <TableCell>{incident.date}</TableCell>
                            <TableCell>{incident.type}</TableCell>
                            <TableCell>
                                <Badge variant={incident.status === 'Clos' ? 'default' : 'secondary'} className={incident.status === 'Enquête' ? 'bg-amber-500 text-white' : ''}>
                                    {incident.status}
                                </Badge>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
          </CardContent>
        </Card>
        
        <Card className="col-span-1">
            <CardHeader className="flex flex-row items-center justify-between">
                <div className="space-y-1">
                    <CardTitle>Mes Tâches / مهامي</CardTitle>
                    <CardDescription>Vos actions en attente.</CardDescription>
                </div>
                <Grab className="cursor-move text-muted-foreground" />
            </CardHeader>
            <CardContent className="space-y-4">
                 <div className="flex items-center space-x-2">
                    <Checkbox id="task1" />
                    <Label htmlFor="task1" className="flex-1">Finaliser le rapport d'audit Q2</Label>
                 </div>
                 <div className="flex items-center space-x-2">
                    <Checkbox id="task2" />
                    <Label htmlFor="task2" className="flex-1">Valider l'action corrective AC-045</Label>
                 </div>
                 <div className="flex items-center space-x-2">
                    <Checkbox id="task3" defaultChecked/>
                    <Label htmlFor="task3" className="flex-1 line-through text-muted-foreground">Planifier la réunion SST de Juillet</Label>
                 </div>
                 <div className="flex items-center space-x-2">
                    <Checkbox id="task4" />
                    <Label htmlFor="task4" className="flex-1">Inspecter l'équipement de levage B-12</Label>
                 </div>
            </CardContent>
        </Card>

      </div>
    </div>
  )
}
