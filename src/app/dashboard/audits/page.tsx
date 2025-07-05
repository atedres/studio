
"use client"

import React, { useState, useEffect } from "react"
import Link from "next/link"
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
import { Skeleton } from "@/components/ui/skeleton"
import { db } from "@/lib/firebase"
import { collection, getDocs, query, orderBy } from "firebase/firestore"

interface Dialogue {
  id: string;
  date: {
      seconds: number;
      nanoseconds: number;
  };
  observateur: string;
  zone: string;
  anomalies: any[];
  status: string;
}

export default function DialoguesSecuritePage() {
  const [dialogues, setDialogues] = useState<Dialogue[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchDialogues = async () => {
        setLoading(true)
        try {
            const q = query(collection(db, "dialoguesSecurite"), orderBy("date", "desc"));
            const querySnapshot = await getDocs(q);
            const dialoguesData = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as Dialogue[];
            setDialogues(dialoguesData);
        } catch (error) {
            console.error("Error fetching dialogues: ", error);
            // Optionally, show a toast message here
        } finally {
            setLoading(false);
        }
    };

    fetchDialogues();
  }, []);

  const getStatusVariant = (status: string) => {
    switch (status) {
      case "Validé":
      case "Clôturée":
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

  const renderSkeleton = () => (
    [...Array(5)].map((_, i) => (
      <TableRow key={i}>
        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
        <TableCell><Skeleton className="h-4 w-32" /></TableCell>
        <TableCell><Skeleton className="h-4 w-40" /></TableCell>
        <TableCell><Skeleton className="h-4 w-12" /></TableCell>
        <TableCell><Skeleton className="h-6 w-32" /></TableCell>
      </TableRow>
    ))
  )

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
              {loading ? renderSkeleton() : dialogues.map((dialogue) => (
                <TableRow key={dialogue.id}>
                  <TableCell className="font-medium">{dialogue.id.substring(0,8)}...</TableCell>
                  <TableCell>{new Date(dialogue.date.seconds * 1000).toLocaleDateString('fr-FR')}</TableCell>
                  <TableCell>{dialogue.observateur}</TableCell>
                  <TableCell>{dialogue.zone}</TableCell>
                  <TableCell className="text-center">{dialogue.anomalies.length}</TableCell>
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
