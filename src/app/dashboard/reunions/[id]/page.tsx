
"use client"

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { doc, getDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Edit, User, CalendarDays, Clock, MapPin, ClipboardList, Info, FileDown, Users as UsersIcon } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';

interface ReunionDetails {
  id: string;
  nature: "presentielle" | "distancielle";
  source: string;
  objet: string;
  date: Timestamp;
  heure: string;
  lieu: string;
  animateur: string;
  duree: string;
  collaborateurs: string;
  supportUrl: string;
  status: string;
}


export default function ReunionDetailPage() {
    const params = useParams();
    const router = useRouter();
    const id = params.id as string;

    const [reunion, setReunion] = useState<ReunionDetails | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!id) return;

        const fetchReunion = async () => {
            setLoading(true);
            const docRef = doc(db, 'reunions', id);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                setReunion({ id: docSnap.id, ...docSnap.data() } as ReunionDetails);
            } else {
                console.log("No such document!");
            }
            setLoading(false);
        };

        fetchReunion();
    }, [id]);

    if (loading) {
        return (
            <div className="space-y-6">
                <div className="flex items-center gap-4">
                    <Skeleton className="h-10 w-10" />
                    <div className="space-y-2">
                        <Skeleton className="h-7 w-80" />
                        <Skeleton className="h-4 w-64" />
                    </div>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 space-y-6">
                        <Skeleton className="h-56" />
                        <Skeleton className="h-40" />
                    </div>
                    <div className="lg:col-span-1">
                        <Skeleton className="h-24" />
                    </div>
                </div>
            </div>
        )
    }

    if (!reunion) {
        return (
            <div className="text-center">
                <p>La réunion demandée n'a pas été trouvée.</p>
                <Button asChild className="mt-4">
                    <Link href="/dashboard/reunions">Retour à la liste</Link>
                </Button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                     <Button variant="outline" size="icon" onClick={() => router.back()}>
                        <ArrowLeft className="h-4 w-4" />
                     </Button>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight font-headline">Détail de la Réunion</h1>
                        <p className="text-muted-foreground">Objet: {reunion.objet}</p>
                    </div>
                </div>
                 <Button>
                    <Edit className="mr-2 h-4 w-4" /> Modifier
                </Button>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Informations Générales</CardTitle>
                        </CardHeader>
                        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6 text-sm">
                            <div className="flex items-center gap-3">
                                <CalendarDays className="h-5 w-5 text-muted-foreground" />
                                <div><strong className="font-medium">Date:</strong> {format(reunion.date.toDate(), 'PPP', { locale: fr })}</div>
                            </div>
                            <div className="flex items-center gap-3">
                                <Clock className="h-5 w-5 text-muted-foreground" />
                                <div><strong className="font-medium">Heure:</strong> {reunion.heure}</div>
                            </div>
                            <div className="flex items-center gap-3">
                                <MapPin className="h-5 w-5 text-muted-foreground" />
                                <div><strong className="font-medium">Lieu / Lien:</strong> {reunion.lieu}</div>
                            </div>
                            <div className="flex items-center gap-3">
                                <User className="h-5 w-5 text-muted-foreground" />
                                <div><strong className="font-medium">Animateur:</strong> {reunion.animateur}</div>
                            </div>
                             <div className="flex items-center gap-3">
                                <ClipboardList className="h-5 w-5 text-muted-foreground" />
                                <div><strong className="font-medium">Source:</strong> {reunion.source}</div>
                            </div>
                            <div className="flex items-center gap-3">
                                <Info className="h-5 w-5 text-muted-foreground" />
                                <div><strong className="font-medium">Nature:</strong> <Badge variant="outline" className="capitalize">{reunion.nature}</Badge></div>
                            </div>
                             <div className="flex items-center gap-3">
                                <Clock className="h-5 w-5 text-muted-foreground" />
                                <div><strong className="font-medium">Durée:</strong> {reunion.duree}</div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><UsersIcon className="h-5 w-5" /> Participants</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{reunion.collaborateurs}</p>
                        </CardContent>
                    </Card>
                </div>

                <div className="lg:col-span-1">
                     <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><FileDown className="h-5 w-5" /> Support de Réunion</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {reunion.supportUrl && reunion.supportUrl !== 'Aucun fichier' ? (
                                <Button asChild className="w-full">
                                    <a href={reunion.supportUrl} target="_blank" rel="noopener noreferrer">
                                        Télécharger le support
                                    </a>
                                </Button>
                            ) : (
                                <p className="text-sm text-muted-foreground text-center">Aucun support fourni.</p>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
