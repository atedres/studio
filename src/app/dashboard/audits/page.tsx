import { FilePlus2, Filter } from "lucide-react"
import Link from "next/link"
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

const dialogues = [
  {
    id: "DS-2407-001",
    date: "2024-07-15",
    observateur: "Karim Alaoui",
    zone: "Atelier de Production",
    anomalies: 2,
    status: "Validé",
  },
  {
    id: "DS-2407-002",
    date: "2024-07-18",
    observateur: "Fatima Zahra",
    zone: "Zone de Stockage",
    anomalies: 0,
    status: "En attente de validation",
  },
  {
    id: "DS-2407-003",
    date: "2024-07-20",
    observateur: "Youssef El Fassi",
    zone: "Ligne d'assemblage 2",
    anomalies: 1,
    status: "Actions correctives ouvertes",
  },
  {
    id: "DS-2407-004",
    date: "2024-07-22",
    observateur: "Amina Benjelloun",
    zone: "Maintenance",
    anomalies: 0,
    status: "Validé",
  },
    {
    id: "DS-2407-005",
    date: "2024-07-25",
    observateur: "Karim Alaoui",
    zone: "Expédition",
    anomalies: 3,
    status: "Brouillon",
  },
]

export default function DialoguesSecuritePage() {
  const getStatusVariant = (status: string) => {
    switch (status) {
      case "Validé":
        return "default"
      case "Brouillon":
        return "secondary"
      case "En attente de validation":
        return "destructive"
      case "Actions correctives ouvertes":
        return "outline"
      default:
        return "secondary"
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight font-headline">Dialogue Sécurité / حوار السلامة</h1>
        <p className="text-muted-foreground">
          Suivi des dialogues sécurité réalisés sur le terrain.
        </p>
      </div>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
            <div className="space-y-1.5">
                <CardTitle>Historique des Dialogues Sécurité</CardTitle>
                <CardDescription>Liste de tous les dialogues sécurité réalisés, en brouillon ou en cours.</CardDescription>
            </div>
            <div className="flex gap-2">
                <Button variant="outline">
                    <Filter className="mr-2 h-4 w-4" />
                    Filtrer
                </Button>
                <Button asChild className="bg-accent hover:bg-accent/90">
                    <Link href="/dashboard/audits/new">
                        <FilePlus2 className="mr-2 h-4 w-4" />
                        Ajouter un DS / إضافة حوار السلامة
                    </Link>
                </Button>
            </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Observateur</TableHead>
                <TableHead>Zone / Unité</TableHead>
                <TableHead>Nb. Anomalies</TableHead>
                <TableHead>Statut</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dialogues.map((dialogue) => (
                <TableRow key={dialogue.id}>
                  <TableCell className="font-medium">{dialogue.id}</TableCell>
                  <TableCell>{dialogue.date}</TableCell>
                  <TableCell>{dialogue.observateur}</TableCell>
                  <TableCell>{dialogue.zone}</TableCell>
                  <TableCell>{dialogue.anomalies}</TableCell>
                  <TableCell>
                    <Badge variant={getStatusVariant(dialogue.status) as any}>{dialogue.status}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
