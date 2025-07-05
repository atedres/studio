
"use client"

import React, { useState, useEffect } from "react"
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
import { PlusCircle, Eye } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { db } from "@/lib/firebase"
import { collection, getDocs, query, orderBy } from "firebase/firestore"

interface Reunion {
    id: string;
    objet: string;
    date: { seconds: number; nanoseconds: number };
    heure: string;
    animateur: string;
    status: string;
}

export default function ReunionsPage() {
  const [reunions, setReunions] = useState<Reunion[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchReunions = async () => {
        setLoading(true);
        try {
            const q = query(collection(db, "reunions"), orderBy("date", "desc"));
            const querySnapshot = await getDocs(q);
            const reunionsData = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as Reunion[];
            setReunions(reunionsData);
        } catch (error) {
            console.error("Error fetching meetings: ", error);
        } finally {
            setLoading(false);
        }
    };

    fetchReunions();
  }, []);

  const getStatusVariant = (status: string) => {
    switch (status) {
      case "Réalisée":
        return "default"
      case "Annulée":
        return "destructive"
      case "Planifiée":
        return "outline"
      default:
        return "secondary"
    }
  }

  const renderSkeleton = () => (
    [...Array(5)].map((_, i) => (
      <TableRow key={i}>
        <TableCell><Skeleton className="h-4 w-48" /></TableCell>
        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
        <TableCell><Skeleton className="h-4 w-16" /></TableCell>
        <TableCell><Skeleton className="h-4 w-32" /></TableCell>
        <TableCell><Skeleton className="h-6 w-24" /></TableCell>
        <TableCell><Skeleton className="h-10 w-10" /></TableCell>
      </TableRow>
    ))
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight font-headline">Gouvernance HSE & Réunions / حوكمة واجتماعات HSE</h1>
        <p className="text-muted-foreground">
          Planification, suivi et reporting des réunions et comités SST.
        </p>
      </div>
      <Card>
          <CardHeader className="flex flex-row items-center justify-between">
              <div>
                  <CardTitle>Historique des Réunions</CardTitle>
                  <CardDescription>Liste de toutes les réunions planifiées et passées.</CardDescription>
              </div>
              <Button asChild className="bg-accent hover:bg-accent/90">
                <Link href="/dashboard/reunions/new">
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Programmer une réunion
                </Link>
              </Button>
          </CardHeader>
          <CardContent>
             <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Objet</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Heure</TableHead>
                        <TableHead>Animateur</TableHead>
                        <TableHead>Statut</TableHead>
                        <TableHead><span className="sr-only">Actions</span></TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {loading ? renderSkeleton() : reunions.map((reunion) => (
                        <TableRow key={reunion.id}>
                            <TableCell className="font-medium">{reunion.objet}</TableCell>
                            <TableCell>{new Date(reunion.date.seconds * 1000).toLocaleDateString('fr-FR')}</TableCell>
                            <TableCell>{reunion.heure}</TableCell>
                            <TableCell>{reunion.animateur}</TableCell>
                            <TableCell>
                                <Badge variant={getStatusVariant(reunion.status) as any}>{reunion.status}</Badge>
                            </TableCell>
                            <TableCell className="text-right">
                                <Button asChild variant="outline" size="icon">
                                    <Link href={`/dashboard/reunions/${reunion.id}`}>
                                        <Eye className="h-4 w-4" />
                                        <span className="sr-only">Voir</span>
                                    </Link>
                                </Button>
                            </TableCell>
                        </TableRow>
                    ))}
                     {!loading && reunions.length === 0 && (
                        <TableRow>
                            <TableCell colSpan={6} className="h-24 text-center">
                            Aucune réunion trouvée.
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
          </CardContent>
      </Card>
    </div>
  )
}
