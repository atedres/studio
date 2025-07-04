import { FilePlus2, Filter } from "lucide-react"
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

const audits = [
  {
    id: "AUD-001",
    date: "2024-07-15",
    auditor: "Karim Alaoui",
    area: "Atelier de Production",
    score: "92%",
    status: "Validé",
  },
  {
    id: "AUD-002",
    date: "2024-07-18",
    auditor: "Fatima Zahra",
    area: "Zone de Stockage",
    score: "85%",
    status: "En attente de validation",
  },
  {
    id: "AUD-003",
    date: "2024-07-20",
    auditor: "Youssef El Fassi",
    area: "Ligne d'assemblage 2",
    score: "78%",
    status: "Actions correctives ouvertes",
  },
  {
    id: "AUD-004",
    date: "2024-07-22",
    auditor: "Amina Benjelloun",
    area: "Maintenance",
    score: "95%",
    status: "Validé",
  },
    {
    id: "AUD-005",
    date: "2024-07-25",
    auditor: "Karim Alaoui",
    area: "Expédition",
    score: "-",
    status: "Planifié",
  },
]

export default function AuditsPage() {
  const getStatusVariant = (status: string) => {
    switch (status) {
      case "Validé":
        return "default"
      case "Planifié":
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
        <h1 className="text-3xl font-bold tracking-tight font-headline">Dialogue Sécurité & Audits / حوار السلامة والتدقيق</h1>
        <p className="text-muted-foreground">
          Suivi des dialogues sécurité et des audits de terrain.
        </p>
      </div>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
            <div className="space-y-1.5">
                <CardTitle>Historique des Audits</CardTitle>
                <CardDescription>Liste de tous les audits réalisés, planifiés et en cours.</CardDescription>
            </div>
            <div className="flex gap-2">
                <Button variant="outline">
                    <Filter className="mr-2 h-4 w-4" />
                    Filtrer
                </Button>
                <Button className="bg-accent hover:bg-accent/90">
                    <FilePlus2 className="mr-2 h-4 w-4" />
                    Nouvel Audit / Audit Nouveau
                </Button>
            </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Auditeur</TableHead>
                <TableHead>Zone / Unité</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Statut</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {audits.map((audit) => (
                <TableRow key={audit.id}>
                  <TableCell className="font-medium">{audit.id}</TableCell>
                  <TableCell>{audit.date}</TableCell>
                  <TableCell>{audit.auditor}</TableCell>
                  <TableCell>{audit.area}</TableCell>
                  <TableCell>{audit.score}</TableCell>
                  <TableCell>
                    <Badge variant={getStatusVariant(audit.status)}>{audit.status}</Badge>
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
