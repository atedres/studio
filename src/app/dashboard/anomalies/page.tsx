
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
import { FilePlus2, TrendingUp, UserCheck, Eye } from "lucide-react"
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts"
import { db } from "@/lib/firebase"
import { collection, getDocs, query, orderBy, where, Timestamp } from "firebase/firestore"
import { startOfMonth, subMonths, format, getMonth, getYear } from 'date-fns';
import { useAuth } from "@/hooks/use-auth"

interface Anomaly {
  avancement: string;
}

interface CAA {
    id: string;
    date: {
        seconds: number;
        nanoseconds: number;
    };
    zone: string;
    animateur: string;
    anomalies: Anomaly[];
    status: string;
}

interface AnomalyStats {
    anomaliesCeMois: number;
    tauxResolution: number;
    anomaliesOuvertes: number;
    topAnimateur: { name: string; count: number };
    anomaliesParMois: { name: string; "Anomalies": number }[];
}

const demoCAAs: CAA[] = [
    { id: 'demo1', date: { seconds: Timestamp.now().seconds, nanoseconds: 0 }, zone: 'Laminoir', animateur: 'Y. Alaoui', anomalies: [{avancement: 'En cours'}, {avancement: 'Réalisée'}], status: 'Ouverte' },
    { id: 'demo2', date: { seconds: Timestamp.from(subMonths(new Date(), 1)).seconds, nanoseconds: 0 }, zone: 'Aciérie', animateur: 'F. Ziani', anomalies: [{avancement: 'Réalisée'}], status: 'Clôturée' },
    { id: 'demo3', date: { seconds: Timestamp.from(subMonths(new Date(), 2)).seconds, nanoseconds: 0 }, zone: 'Logistique', animateur: 'Y. Alaoui', anomalies: [{avancement: 'En cours'}, {avancement: 'En cours'}], status: 'Ouverte' },
    { id: 'demo4', date: { seconds: Timestamp.now().seconds, nanoseconds: 0 }, zone: 'Laminoir', animateur: 'A. Saidi', anomalies: [], status: 'Brouillon' },
];

const demoStats: AnomalyStats = {
    anomaliesCeMois: 5,
    tauxResolution: 68,
    anomaliesOuvertes: 12,
    topAnimateur: { name: 'Y. Alaoui', count: 15 },
    anomaliesParMois: [
        { name: format(subMonths(new Date(), 5), 'MMM'), "Anomalies": 22 },
        { name: format(subMonths(new Date(), 4), 'MMM'), "Anomalies": 18 },
        { name: format(subMonths(new Date(), 3), 'MMM'), "Anomalies": 25 },
        { name: format(subMonths(new Date(), 2), 'MMM'), "Anomalies": 30 },
        { name: format(subMonths(new Date(), 1), 'MMM'), "Anomalies": 21 },
        { name: format(new Date(), 'MMM'), "Anomalies": 5 },
    ]
};

export default function AnomaliesPage() {
    const [caas, setCaas] = useState<CAA[]>([])
    const [stats, setStats] = useState<AnomalyStats | null>(null)
    const [loading, setLoading] = useState(true)
    const { user, isDemoMode } = useAuth()

    useEffect(() => {
        if (isDemoMode) {
            setCaas(demoCAAs);
            setStats(demoStats);
            setLoading(false);
            return;
        }

        const calculateStats = (data: CAA[]) => {
            const now = new Date();
            const debutMois = startOfMonth(now);
            
            const allAnomalies = data.flatMap(caa => caa.anomalies);

            // Anomalies ce mois-ci
            const anomaliesCeMois = data
                .filter(caa => new Date(caa.date.seconds * 1000) >= debutMois)
                .reduce((acc, caa) => acc + caa.anomalies.length, 0);

            // Taux de résolution
            const anomaliesRealisees = allAnomalies.filter(a => a.avancement === 'Réalisée').length;
            const tauxResolution = allAnomalies.length > 0 ? Math.round((anomaliesRealisees / allAnomalies.length) * 100) : 0;

            // Anomalies ouvertes
            const anomaliesOuvertes = allAnomalies.filter(a => a.avancement !== 'Réalisée').length;
            
            // Top Animateur
            const animateurCounts = data.reduce((acc, caa) => {
                acc[caa.animateur] = (acc[caa.animateur] || 0) + 1;
                return acc;
            }, {} as Record<string, number>);

            const topAnimateur = Object.entries(animateurCounts).reduce((top, [name, count]) => {
                return count > top.count ? { name, count } : top;
            }, { name: 'N/A', count: 0 });


            // Anomalies par mois (6 derniers mois)
            const anomaliesParMoisMap = new Map<string, number>();
             for (let i = 5; i >= 0; i--) {
                const d = subMonths(now, i);
                const monthName = format(d, 'MMM');
                anomaliesParMoisMap.set(monthName, 0);
            }
            data.forEach(caa => {
                const date = new Date(caa.date.seconds * 1000);
                 const monthName = format(date, 'MMM');
                if (anomaliesParMoisMap.has(monthName)) {
                   anomaliesParMoisMap.set(monthName, (anomaliesParMoisMap.get(monthName) || 0) + caa.anomalies.length);
                }
            });

            const anomaliesParMois = Array.from(anomaliesParMoisMap.entries()).map(([name, count]) => ({
                name,
                "Anomalies": count,
            }));

            setStats({
                anomaliesCeMois,
                tauxResolution,
                anomaliesOuvertes,
                topAnimateur,
                anomaliesParMois,
            });
        }

        const fetchCAAs = async () => {
            if (!user) return;
            setLoading(true);
            try {
                let caasQuery;
                const baseQuery = collection(db, "chassesAuxAnomalies");

                switch(user.role) {
                    case 'niveau1':
                    case 'niveau2':
                        caasQuery = query(baseQuery, where("createdBy", "==", user.uid), orderBy("date", "desc"));
                        break;
                    case 'niveau3':
                    case 'niveau4':
                    case 'niveau5':
                        caasQuery = query(baseQuery, where("zone", "==", user.entity), orderBy("date", "desc"));
                        break;
                    case 'admin':
                        caasQuery = query(baseQuery, orderBy("date", "desc"));
                        break;
                    default:
                        // Return no results if role is not recognized
                        caasQuery = query(baseQuery, where("createdBy", "==", "no-one"));
                        break;
                }
                
                const querySnapshot = await getDocs(caasQuery);
                const caasData = querySnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                })) as CAA[];
                setCaas(caasData);
                calculateStats(caasData);
            } catch (error) {
                console.error("Error fetching CAAs: ", error);
            } finally {
                setLoading(false);
            }
        };

        fetchCAAs();
    }, [user, isDemoMode]);


    const getStatusVariant = (status: string) => {
        switch (status) {
          case "Clôturée":
            return "default"
          case "Ouverte":
            return "destructive"
          case "Actions en cours":
            return "outline"
          case "Brouillon":
            return "secondary"
          default:
            return "secondary"
        }
    }
    
  const renderSkeleton = () => (
    [...Array(4)].map((_, i) => (
      <TableRow key={i}>
        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
        <TableCell><Skeleton className="h-4 w-32" /></TableCell>
        <TableCell><Skeleton className="h-4 w-40" /></TableCell>
        <TableCell><Skeleton className="h-4 w-12" /></TableCell>
        <TableCell><Skeleton className="h-6 w-32" /></TableCell>
        <TableCell><Skeleton className="h-10 w-10" /></TableCell>
      </TableRow>
    ))
  )

  const getLinkHref = (caa: CAA) => {
    if (isDemoMode) return '#';
    return caa.status === 'Brouillon' ? `/dashboard/anomalies/${caa.id}/edit` : `/dashboard/anomalies/${caa.id}`;
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
             {loading ? <Skeleton className="h-7 w-12" /> : <div className="text-2xl font-bold">{stats?.anomaliesCeMois}</div>}
             <p className="text-xs text-muted-foreground">Depuis le début du mois</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taux de Résolution</CardTitle>
             <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-7 w-16" /> : <div className="text-2xl font-bold">{stats?.tauxResolution}%</div>}
            <p className="text-xs text-muted-foreground">Sur toutes les anomalies</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Anomalies Ouvertes</CardTitle>
             <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
             {loading ? <Skeleton className="h-7 w-12" /> : <div className="text-2xl font-bold">{stats?.anomaliesOuvertes}</div>}
            <p className="text-xs text-muted-foreground">Actions non clôturées</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Top Animateur</CardTitle>
             <UserCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-7 w-32" /> : <div className="text-2xl font-bold">{stats?.topAnimateur.name}</div>}
            {loading ? <Skeleton className="h-4 w-24 mt-1" /> : <p className="text-xs text-muted-foreground">Avec {stats?.topAnimateur.count} CAA</p>}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-full lg:col-span-4">
            <CardHeader>
                <CardTitle>Rapports de Chasse aux Anomalies</CardTitle>
                <CardDescription>Liste de toutes les CAA réalisées.</CardDescription>
            </CardHeader>
            <CardContent>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>ID CAA</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Zone</TableHead>
                        <TableHead>Animateur</TableHead>
                        <TableHead>Nb. Anomalies</TableHead>
                        <TableHead>Statut</TableHead>
                        <TableHead><span className="sr-only">Actions</span></TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {loading ? renderSkeleton() : caas.map((caa) => (
                        <TableRow key={caa.id}>
                            <TableCell className="font-medium">{caa.id.substring(0,8)}...</TableCell>
                            <TableCell>{new Date(caa.date.seconds * 1000).toLocaleDateString('fr-FR')}</TableCell>
                            <TableCell>{caa.zone}</TableCell>
                            <TableCell>{caa.animateur}</TableCell>
                            <TableCell className="text-center">{caa.anomalies.length}</TableCell>
                            <TableCell><Badge variant={getStatusVariant(caa.status) as any}>{caa.status}</Badge></TableCell>
                             <TableCell className="text-right">
                                <Button asChild variant="outline" size="icon" disabled={isDemoMode}>
                                    <Link href={getLinkHref(caa)}>
                                        <Eye className="h-4 w-4" />
                                        <span className="sr-only">{caa.status === 'Brouillon' ? 'Modifier' : 'Voir'}</span>
                                    </Link>
                                </Button>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
            </CardContent>
        </Card>
        <Card className="col-span-full lg:col-span-3 min-w-0">
            <CardHeader>
                <CardTitle>Anomalies par Mois</CardTitle>
                <CardDescription>Nombre d'anomalies signalées au cours des 6 derniers mois.</CardDescription>
            </CardHeader>
            <CardContent>
                {loading || !stats ? <Skeleton className="w-full h-[300px]" /> :
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={stats.anomaliesParMois}>
                            <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                            <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                            <Tooltip />
                            <Bar dataKey="Anomalies" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                }
            </CardContent>
        </Card>
      </div>
        <div className="fixed bottom-8 right-8">
            <Button asChild size="lg" className="rounded-full h-16 w-16 shadow-lg bg-accent hover:bg-accent/90" disabled={isDemoMode}>
                <Link href={isDemoMode ? "#" : "/dashboard/anomalies/new"}>
                    <FilePlus2 className="h-8 w-8" />
                    <span className="sr-only">Ajouter une CAA</span>
                </Link>
            </Button>
        </div>
    </div>
  )
}
