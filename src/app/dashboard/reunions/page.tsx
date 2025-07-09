
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
import { Skeleton } from "@/components/ui/skeleton"
import { PlusCircle, Eye, CalendarCheck, Users, TrendingUp } from "lucide-react"
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts"
import { db } from "@/lib/firebase"
import { collection, getDocs, query, orderBy, Timestamp } from "firebase/firestore"
import { startOfMonth, subMonths, format } from 'date-fns'
import { useAuth } from "@/hooks/use-auth"

interface Reunion {
    id: string;
    objet: string;
    date: { seconds: number; nanoseconds: number };
    heure: string;
    animateur: string;
    status: string;
}

interface ReunionStats {
    reunionsCeMois: number;
    reunionsPlanifiees: number;
    topAnimateur: { name: string; count: number };
    reunionsParMois: { name: string; "Réunions": number }[];
}

const demoReunions: Reunion[] = [
    { id: 'demo-r-1', objet: 'Revue mensuelle de la sécurité', date: { seconds: Timestamp.now().seconds, nanoseconds: 0 }, heure: '10:00', animateur: 'Y. Alaoui', status: 'Planifiée' },
    { id: 'demo-r-2', objet: 'Analyse des incidents de la semaine', date: { seconds: Timestamp.from(subMonths(new Date(), 1)).seconds, nanoseconds: 0 }, heure: '14:30', animateur: 'A. Saidi', status: 'Réalisée' },
    { id: 'demo-r-3', objet: 'Formation aux premiers secours', date: { seconds: Timestamp.from(subMonths(new Date(), 2)).seconds, nanoseconds: 0 }, heure: '09:00', animateur: 'F. Ziani', status: 'Annulée' },
];

const demoStats: ReunionStats = {
    reunionsCeMois: 4,
    reunionsPlanifiees: 6,
    topAnimateur: { name: 'Y. Alaoui', count: 8 },
    reunionsParMois: [
        { name: format(subMonths(new Date(), 5), 'MMM'), "Réunions": 5 },
        { name: format(subMonths(new Date(), 4), 'MMM'), "Réunions": 7 },
        { name: format(subMonths(new Date(), 3), 'MMM'), "Réunions": 6 },
        { name: format(subMonths(new Date(), 2), 'MMM'), "Réunions": 8 },
        { name: format(subMonths(new Date(), 1), 'MMM'), "Réunions": 5 },
        { name: format(new Date(), 'MMM'), "Réunions": 4 },
    ]
};

export default function ReunionsPage() {
  const [reunions, setReunions] = useState<Reunion[]>([])
  const [stats, setStats] = useState<ReunionStats | null>(null)
  const [loading, setLoading] = useState(true)
  const { user, isDemoMode } = useAuth();

  const canManage = user && ['niveau2', 'niveau3', 'niveau4', 'niveau5', 'admin'].includes(user.role);

  useEffect(() => {
    if (isDemoMode) {
      setReunions(demoReunions);
      setStats(demoStats);
      setLoading(false);
      return;
    }
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
            calculateStats(reunionsData);
        } catch (error) {
            console.error("Error fetching meetings: ", error);
        } finally {
            setLoading(false);
        }
    };

    const calculateStats = (data: Reunion[]) => {
        const now = new Date();
        const debutMois = startOfMonth(now);
        
        const reunionsCeMois = data.filter(r => new Date(r.date.seconds * 1000) >= debutMois).length;
        const reunionsPlanifiees = data.filter(r => r.status === 'Planifiée').length;
        
        const animateurCounts = data.reduce((acc, reunion) => {
            acc[reunion.animateur] = (acc[reunion.animateur] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        const topAnimateur = Object.entries(animateurCounts).reduce((top, [name, count]) => {
            return count > top.count ? { name, count } : top;
        }, { name: 'N/A', count: 0 });

        const reunionsParMoisMap = new Map<string, number>();
         for (let i = 5; i >= 0; i--) {
            const d = subMonths(now, i);
            const monthName = format(d, 'MMM');
            reunionsParMoisMap.set(monthName, 0);
        }
        data.forEach(reunion => {
            const date = new Date(reunion.date.seconds * 1000);
             const monthName = format(date, 'MMM');
            if (reunionsParMoisMap.has(monthName)) {
               reunionsParMoisMap.set(monthName, (reunionsParMoisMap.get(monthName) || 0) + 1);
            }
        });

        const reunionsParMois = Array.from(reunionsParMoisMap.entries()).map(([name, count]) => ({
            name,
            "Réunions": count,
        }));

        setStats({
            reunionsCeMois,
            reunionsPlanifiees,
            topAnimateur,
            reunionsParMois,
        });
    }

    fetchReunions();
  }, [isDemoMode]);

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
  
  const getLinkHref = (reunion: Reunion) => {
    if (isDemoMode) return "#";
    return `/dashboard/reunions/${reunion.id}`;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight font-headline">Gouvernance HSE & Réunions / حوكمة واجتماعات HSE</h1>
        <p className="text-muted-foreground">
          Planification, suivi et reporting des réunions et comités SST.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Réunions ce Mois-ci</CardTitle>
            <CalendarCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
             {loading ? <Skeleton className="h-7 w-12" /> : <div className="text-2xl font-bold">{stats?.reunionsCeMois}</div>}
             <p className="text-xs text-muted-foreground">Depuis le début du mois</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Réunions à Venir</CardTitle>
             <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-7 w-16" /> : <div className="text-2xl font-bold">{stats?.reunionsPlanifiees}</div>}
            <p className="text-xs text-muted-foreground">Statut "Planifiée"</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Top Animateur</CardTitle>
             <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-7 w-32" /> : <div className="text-2xl font-bold">{stats?.topAnimateur.name}</div>}
            {loading ? <Skeleton className="h-4 w-24 mt-1" /> : <p className="text-xs text-muted-foreground">Avec {stats?.topAnimateur.count} réunions</p>}
          </CardContent>
        </Card>
      </div>
      
       <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
          <Card className="col-span-full lg:col-span-4">
              <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                      <CardTitle>Historique des Réunions</CardTitle>
                      <CardDescription>Liste de toutes les réunions planifiées et passées.</CardDescription>
                  </div>
                  {canManage && (
                    <Button asChild className="bg-accent hover:bg-accent/90" disabled={isDemoMode}>
                      <Link href={isDemoMode ? "#" : "/dashboard/reunions/new"}>
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Programmer une réunion
                      </Link>
                    </Button>
                  )}
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
                                    <Button asChild variant="outline" size="icon" disabled={isDemoMode}>
                                        <Link href={getLinkHref(reunion)}>
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
           <Card className="col-span-full lg:col-span-3 min-w-0">
                <CardHeader>
                    <CardTitle>Réunions par Mois</CardTitle>
                    <CardDescription>Nombre de réunions tenues au cours des 6 derniers mois.</CardDescription>
                </CardHeader>
                <CardContent>
                    {loading || !stats ? <Skeleton className="w-full h-[300px]" /> :
                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={stats.reunionsParMois}>
                                <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                                <Tooltip />
                                <Bar dataKey="Réunions" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    }
                </CardContent>
            </Card>
      </div>
    </div>
  )
}
