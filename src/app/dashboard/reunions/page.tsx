
"use client"

import React, { useState, useEffect } from "react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { PlusCircle, Video, Users } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { db } from "@/lib/firebase"
import { collection, getDocs, query, orderBy, where } from "firebase/firestore"

interface Reunion {
    id: string;
    objet: string;
    date: { seconds: number; nanoseconds: number };
    heure: string;
    source: string;
    collaborateurs: string;
}

export default function ReunionsPage() {
  const [reunions, setReunions] = useState<Reunion[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = React.useState<Date | undefined>(new Date())

  useEffect(() => {
    const fetchReunions = async () => {
        setLoading(true);
        try {
            const q = query(collection(db, "reunions"), where("date", ">=", new Date()), orderBy("date", "asc"));
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

  const renderSkeleton = () => (
    [...Array(3)].map((_, i) => (
        <div key={i} className="flex items-center justify-between p-4 rounded-lg border">
            <div className="flex items-center gap-4 w-full">
                <div className="flex flex-col text-center bg-muted p-2 rounded-md w-20">
                    <Skeleton className="h-4 w-10 mx-auto" />
                    <Skeleton className="h-6 w-8 mx-auto mt-1" />
                </div>
                <div className="flex-1 space-y-2">
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                </div>
            </div>
            <Skeleton className="h-10 w-10 rounded-md" />
        </div>
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
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>Réunions à venir</CardTitle>
                    <CardDescription>Liste des prochaines réunions planifiées.</CardDescription>
                </div>
                <Button asChild className="bg-accent hover:bg-accent/90">
                  <Link href="/dashboard/reunions/new">
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Programmer une réunion
                  </Link>
                </Button>
            </CardHeader>
            <CardContent className="space-y-4">
                {loading ? renderSkeleton() : reunions.map((meeting) => (
                    <div key={meeting.id} className="flex items-center justify-between p-4 rounded-lg border">
                        <div className="flex items-center gap-4">
                            <div className="flex flex-col text-center bg-muted p-2 rounded-md w-20">
                                <span className="text-sm font-semibold">{new Date(meeting.date.seconds * 1000).toLocaleDateString('fr-FR', { month: 'short' })}</span>
                                <span className="text-2xl font-bold">{new Date(meeting.date.seconds * 1000).getDate()}</span>
                            </div>
                            <div>
                                <h3 className="font-semibold">{meeting.objet}</h3>
                                <p className="text-sm text-muted-foreground">{meeting.heure}</p>
                                <div className="flex items-center gap-2 mt-1">
                                    <Badge variant="secondary">{meeting.source}</Badge>
                                    <span className="text-xs text-muted-foreground flex items-center"><Users className="h-3 w-3 mr-1" />
                                        {meeting.collaborateurs.split(/, ?|\n/).filter(p => p.trim() !== '').length} participants
                                    </span>
                                </div>
                            </div>
                        </div>
                        <Button variant="ghost" size="icon">
                            <Video className="h-5 w-5 text-accent" />
                        </Button>
                    </div>
                 ))}
                 {!loading && reunions.length === 0 && (
                    <p className="text-center text-muted-foreground py-8">Aucune réunion à venir.</p>
                )}
            </CardContent>
        </Card>
        <Card>
            <CardHeader>
                <CardTitle>Calendrier</CardTitle>
                <CardDescription>Vue d'ensemble des événements HSE.</CardDescription>
            </CardHeader>
            <CardContent>
                <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={setSelectedDate}
                    className="rounded-md border p-0"
                />
            </CardContent>
        </Card>
      </div>
    </div>
  )
}
