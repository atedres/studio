
'use client'

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  AlertOctagon,
  CheckSquare,
  Eye,
  Grab,
  Loader2,
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
import { db } from "@/lib/firebase"
import { collection, getDocs, doc, getDoc, updateDoc } from "firebase/firestore"
import { subMonths, format, startOfMonth } from 'date-fns';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from "@/hooks/use-toast"

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
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';

// Interfaces for our Firestore data
interface Anomaly {
  description: string;
  echeance?: { seconds: number };
  responsable?: string;
  statut?: string; // For DS
  avancement?: string; // for CAA
  famille?: string; // For CAA
  familleRisque?: string; // For DS
}

interface DialogueSecurite {
  id: string;
  date: { seconds: number };
  anomalies: Anomaly[];
}

interface ChasseAuxAnomalies {
  id: string;
  date: { seconds: number };
  zone: string;
  status: string;
  anomalies: Anomaly[];
}

interface DashboardData {
  actionsEnRetard: number;
  auditsRealises: {
    total: number;
    ceMois: number;
  };
  totalAnomalies: number;
  incidentsRecents: ChasseAuxAnomalies[];
  anomaliesParType: { name: string; value: number; fill: string }[];
  activiteParMois: { name: string; Dialogues: number; CAA: number }[];
}

interface Task extends Anomaly {
    taskId: string;
    docId: string;
    docType: 'audit' | 'anomaly';
    docSource: string;
}

const CHART_COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const [myTasks, setMyTasks] = useState<Task[]>([]);
  const { toast } = useToast();
  const [updatingTasks, setUpdatingTasks] = useState<string[]>([]);

  const fetchData = async () => {
      if (!user) { // Don't fetch if user is not loaded
          setLoading(false);
          return;
      }
      setLoading(true);
      try {
        const dialoguesSnapshot = await getDocs(collection(db, "dialoguesSecurite"));
        const caasSnapshot = await getDocs(collection(db, "chassesAuxAnomalies"));

        const dialogues = dialoguesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as DialogueSecurite[];
        const caas = caasSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as ChasseAuxAnomalies[];

        // 1. Actions en retard
        const now = new Date();
        let actionsEnRetard = 0;
        const allAnomaliesFromDS = dialogues.flatMap(d => d.anomalies);
        const allAnomaliesFromCAA = caas.flatMap(c => c.anomalies);
        const allAnomalies = [...allAnomaliesFromDS, ...allAnomaliesFromCAA];
        
        allAnomalies.forEach(anomaly => {
          const status = anomaly.statut || anomaly.avancement;
          if (anomaly.echeance && new Date(anomaly.echeance.seconds * 1000) < now && status !== "Réalisée") {
            actionsEnRetard++;
          }
        });
        
        // 2. Audits réalisés
        const ceMoisStart = startOfMonth(now);
        const auditsCeMois = dialogues.filter(d => new Date(d.date.seconds * 1000) >= ceMoisStart).length;
        const auditsRealises = {
          total: dialogues.length,
          ceMois: auditsCeMois,
        };

        // 3. Incidents récents (using recent CAAs)
        const incidentsRecents = caas
          .sort((a, b) => b.date.seconds - a.date.seconds)
          .slice(0, 3);

        // 4. Anomalies par type (famille de risque)
        const anomaliesByTypeMap = new Map<string, number>();
        allAnomalies.forEach(anomaly => {
          const famille = anomaly.famille || anomaly.familleRisque || 'Non défini';
          anomaliesByTypeMap.set(famille, (anomaliesByTypeMap.get(famille) || 0) + 1);
        });
        const anomaliesParType = Array.from(anomaliesByTypeMap.entries()).map(([name, value], index) => ({
          name,
          value,
          fill: CHART_COLORS[index % CHART_COLORS.length],
        }));

        // 5. Activité par mois (last 6 months)
        const activiteParMoisMap = new Map<string, { Dialogues: number; CAA: number }>();
        for (let i = 5; i >= 0; i--) {
            const date = subMonths(now, i);
            const monthName = format(date, 'MMM');
            activiteParMoisMap.set(monthName, { Dialogues: 0, CAA: 0 });
        }

        dialogues.forEach(d => {
            const monthName = format(new Date(d.date.seconds * 1000), 'MMM');
            if (activiteParMoisMap.has(monthName)) {
                activiteParMoisMap.get(monthName)!.Dialogues++;
            }
        });
        caas.forEach(c => {
            const monthName = format(new Date(c.date.seconds * 1000), 'MMM');
            if (activiteParMoisMap.has(monthName)) {
                activiteParMoisMap.get(monthName)!.CAA++;
            }
        });

        const activiteParMois = Array.from(activiteParMoisMap.entries()).map(([name, values]) => ({
            name,
            ...values
        }));

        // 6. User tasks
        const userDialoguesTasks: Task[] = dialogues.flatMap(d => 
            d.anomalies
             .map((a, i) => ({
                ...a,
                taskId: `${d.id}-${i}`,
                docId: d.id,
                docType: 'audit' as const,
                docSource: `DS ${d.id.substring(0,4)}...`
             }))
             .filter(a => a.responsable?.toLowerCase() === user.email?.toLowerCase() && a.statut !== 'Réalisée')
        );

        const userCaasTasks: Task[] = caas.flatMap(c => 
            c.anomalies
             .map((a, i) => ({
                ...a,
                taskId: `${c.id}-${i}`,
                docId: c.id,
                docType: 'anomaly' as const,
                docSource: `CAA ${c.id.substring(0,4)}...`
             }))
             .filter(a => a.responsable?.toLowerCase() === user.email?.toLowerCase() && a.avancement !== 'Réalisée')
        );
        
        setMyTasks([...userDialoguesTasks, ...userCaasTasks]);

        setData({
          actionsEnRetard,
          auditsRealises,
          totalAnomalies: allAnomalies.length,
          incidentsRecents,
          anomaliesParType,
          activiteParMois
        });

      } catch (error) {
        console.error("Error fetching dashboard data:", error);
         toast({
          variant: "destructive",
          title: "Erreur de chargement",
          description: "Impossible de récupérer les données du tableau de bord.",
        })
      } finally {
        setLoading(false);
      }
    };
  
  useEffect(() => {
    if (user) {
      fetchData();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handleTaskCompletion = async (task: Task) => {
    setUpdatingTasks(prev => [...prev, task.taskId]);
    const collectionName = task.docType === 'audit' ? 'dialoguesSecurite' : 'chassesAuxAnomalies';
    const docRef = doc(db, collectionName, task.docId);

    try {
        const docSnap = await getDoc(docRef);
        if (!docSnap.exists()) throw new Error("Document non trouvé.");

        const data = docSnap.data();
        const taskIndex = parseInt(task.taskId.split('-').pop()!, 10);
        
        if (isNaN(taskIndex) || !data.anomalies || !data.anomalies[taskIndex]) {
             throw new Error("Tâche non trouvée dans le document.");
        }

        const updatedAnomalies = [...data.anomalies];
        const currentTask = updatedAnomalies[taskIndex];

        if (task.docType === 'audit') {
            currentTask.statut = 'Réalisée';
        } else {
            currentTask.avancement = 'Réalisée';
        }

        await updateDoc(docRef, { anomalies: updatedAnomalies });

        setMyTasks(prevTasks => prevTasks.filter(t => t.taskId !== task.taskId));
        
        // Optimistic update for "Actions en retard" counter
        if (currentTask.echeance && new Date(currentTask.echeance.seconds * 1000) < new Date()) {
          setData(prevData => prevData ? {...prevData, actionsEnRetard: Math.max(0, prevData.actionsEnRetard - 1)} : null);
        }

        toast({
            title: "Tâche terminée !",
            description: "L'action a été marquée comme réalisée.",
        });
    } catch (error) {
        console.error("Error updating task: ", error);
        toast({
            variant: "destructive",
            title: "Erreur",
            description: "Impossible de mettre à jour la tâche.",
        });
    } finally {
        setUpdatingTasks(prev => prev.filter(id => id !== task.taskId));
    }
};

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
                <CardTitle>Activité par mois / النشاط الشهري</CardTitle>
                <CardDescription>Dialogues Sécurité et Chasses aux Anomalies réalisés.</CardDescription>
            </div>
            <Grab className="cursor-move text-muted-foreground" />
          </CardHeader>
          <CardContent className="h-[300px]">
            {loading ? <Skeleton className="w-full h-full" /> : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data?.activiteParMois}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="Dialogues" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="CAA" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="space-y-1">
                <CardTitle>Anomalies par Famille / الحالات الشاذة حسب العائلة</CardTitle>
                <CardDescription>Répartition des anomalies signalées.</CardDescription>
            </div>
            <Grab className="cursor-move text-muted-foreground" />
          </CardHeader>
          <CardContent className="h-[300px]">
             {loading ? <Skeleton className="w-full h-full rounded-full" /> : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={data?.anomaliesParType} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                      {data?.anomaliesParType.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.fill} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
             )}
          </CardContent>
        </Card>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 col-span-1 lg:col-span-3 gap-6">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Actions en Retard</CardTitle>
                    <AlertOctagon className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    {loading ? <Skeleton className="h-8 w-12" /> : <div className="text-2xl font-bold text-destructive">{data?.actionsEnRetard}</div>}
                    <p className="text-xs text-muted-foreground">Actions correctives non clôturées</p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Dialogues Réalisés</CardTitle>
                    <CheckSquare className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    {loading ? <Skeleton className="h-8 w-20" /> : <div className="text-2xl font-bold">{data?.auditsRealises.total}</div>}
                    <p className="text-xs text-muted-foreground">+{data?.auditsRealises.ceMois} ce mois-ci</p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Anomalies Signalées</CardTitle>
                    <Activity className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                     {loading ? <Skeleton className="h-8 w-12" /> : <div className="text-2xl font-bold">{data?.totalAnomalies}</div>}
                    <p className="text-xs text-muted-foreground">Toutes sources confondues</p>
                </CardContent>
            </Card>
        </div>


        <Card className="col-span-1 lg:col-span-3 xl:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="space-y-1">
                <CardTitle>Chasses aux Anomalies Récentes</CardTitle>
                <CardDescription>Liste des dernières CAA et leur statut.</CardDescription>
            </div>
            <Grab className="cursor-move text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>ID</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Zone</TableHead>
                        <TableHead>Statut</TableHead>
                        <TableHead><span className="sr-only">Actions</span></TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {loading ? (
                      [...Array(3)].map((_, i) => (
                        <TableRow key={i}>
                          <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                          <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                          <TableCell><Skeleton className="h-10 w-10" /></TableCell>
                        </TableRow>
                      ))
                    ) : (
                      data?.incidentsRecents.map((incident) => (
                         <TableRow key={incident.id}>
                            <TableCell className="font-medium">{incident.id.substring(0, 8)}...</TableCell>
                            <TableCell>{format(new Date(incident.date.seconds * 1000), 'dd/MM/yyyy')}</TableCell>
                            <TableCell>{incident.zone}</TableCell>
                            <TableCell>
                                <Badge variant={incident.status === 'Clôturée' ? 'default' : incident.status === 'Ouverte' ? 'destructive' : 'secondary'}>
                                    {incident.status}
                                </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                                <Button asChild variant="outline" size="icon">
                                    <Link href={`/dashboard/anomalies/${incident.id}`}>
                                        <Eye className="h-4 w-4" />
                                        <span className="sr-only">Voir</span>
                                    </Link>
                                </Button>
                            </TableCell>
                        </TableRow>
                    )))}
                    {!loading && data?.incidentsRecents.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground">Aucune Chasse aux Anomalies récente.</TableCell>
                      </TableRow>
                    )}
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
                 {loading ? (
                    [...Array(4)].map((_, i) => (
                        <div key={i} className="flex items-center space-x-2">
                            <Skeleton className="h-4 w-4" />
                            <Skeleton className="h-4 flex-1" />
                        </div>
                    ))
                ) : myTasks.length > 0 ? (
                    myTasks.map((task) => (
                        <div key={task.taskId} className="flex items-center space-x-2 group">
                             {updatingTasks.includes(task.taskId) ? (
                                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                            ) : (
                                <Checkbox
                                    id={task.taskId}
                                    onCheckedChange={() => handleTaskCompletion(task)}
                                />
                            )}
                             <Link href={task.docType === 'audit' ? `/dashboard/audits/${task.docId}` : `/dashboard/anomalies/${task.docId}`} className="flex-1 cursor-pointer">
                                <Label htmlFor={task.taskId} className="flex-1 font-normal cursor-pointer group-hover:underline">
                                    {task.description}
                                    <span className="ml-2 text-xs text-muted-foreground">({task.docSource})</span>
                                </Label>
                            </Link>
                        </div>
                    ))
                ) : (
                    <p className="text-sm text-muted-foreground text-center pt-4">Aucune tâche en attente. Bravo !</p>
                )}
            </CardContent>
        </Card>

      </div>
    </div>
  )
}
