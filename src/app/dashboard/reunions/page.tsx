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
import { List, PlusCircle, Video } from "lucide-react"

const upcomingMeetings = [
    {
        title: "Réunion mensuelle SST - Juillet",
        date: "2024-07-28",
        time: "10:00 - 11:30",
        type: "Mensuelle",
        participants: 12
    },
    {
        title: "Revue du plan d'action - Incident INC-0123",
        date: "2024-08-02",
        time: "14:00 - 15:00",
        type: "Suivi",
        participants: 5
    },
    {
        title: "Formation Nouveaux Arrivants - Risques Chimiques",
        date: "2024-08-05",
        time: "09:00 - 12:00",
        type: "Formation",
        participants: 8
    }
]

export default function ReunionsPage() {
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
                <Button className="bg-accent hover:bg-accent/90">
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Planifier une réunion
                </Button>
            </CardHeader>
            <CardContent className="space-y-4">
            {upcomingMeetings.map((meeting, index) => (
                <div key={index} className="flex items-center justify-between p-4 rounded-lg border">
                    <div className="flex items-center gap-4">
                        <div className="flex flex-col text-center bg-muted p-2 rounded-md w-20">
                            <span className="text-sm font-semibold">{new Date(meeting.date).toLocaleDateString('fr-FR', { month: 'short' })}</span>
                            <span className="text-2xl font-bold">{new Date(meeting.date).getDate()}</span>
                        </div>
                        <div>
                            <h3 className="font-semibold">{meeting.title}</h3>
                            <p className="text-sm text-muted-foreground">{meeting.time}</p>
                            <div className="flex items-center gap-2 mt-1">
                                <Badge variant="secondary">{meeting.type}</Badge>
                                <span className="text-xs text-muted-foreground flex items-center"><Users className="h-3 w-3 mr-1" />{meeting.participants} participants</span>
                            </div>
                        </div>
                    </div>
                    <Button variant="ghost" size="icon">
                        <Video className="h-5 w-5 text-accent" />
                    </Button>
                </div>
             ))}
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
                    selected={new Date()}
                    className="rounded-md border p-0"
                />
            </CardContent>
        </Card>
      </div>
    </div>
  )
}
