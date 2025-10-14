import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { differenceInCalendarDays, format } from 'date-fns';
import { useGame } from '@/contexts/GameContext';
import { EquipmentCard } from '@/components/EquipmentCard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Calendar, Wrench } from 'lucide-react';
import { toast } from 'sonner';
import { Department, EquipmentItem, EquipmentType } from '@/types/game';
import { getAllEquipmentTypes, getEquipmentDefinition } from '@/lib/equipment';

const departmentTabs: (Department | 'all')[] = ['all', 'audio', 'lighting', 'video', 'stage'];

export default function Inventory() {
  const navigate = useNavigate();
  const { gameState, scheduleEquipmentMaintenance, rentEquipment } = useGame();
  const [selectedRentalType, setSelectedRentalType] = useState<EquipmentType>('pa-system');
  const [rentalDays, setRentalDays] = useState(3);
  const [activeTab, setActiveTab] = useState<(typeof departmentTabs)[number]>('all');

  const equipmentStats = useMemo(() => {
    const { equipment, currentDate } = gameState;
    const owned = equipment.filter(item => item.owned).length;
    const rentals = equipment.filter(item => !item.owned).length;
    const inMaintenance = equipment.filter(item => item.status === 'maintenance').length;
    const assigned = equipment.filter(item => item.status === 'assigned').length;

    const dueSoon = equipment.filter(item => {
      if (item.status === 'maintenance') return false;
      const daysUntilDue = differenceInCalendarDays(item.maintenanceDue, currentDate);
      return daysUntilDue >= 0 && daysUntilDue <= 7;
    });

    return {
      owned,
      rentals,
      inMaintenance,
      assigned,
      dueSoon,
    };
  }, [gameState]);

  const equipmentByTab = useMemo(() => {
    const mapping = new Map<(typeof departmentTabs)[number], EquipmentItem[]>();
    departmentTabs.forEach(tab => {
      if (tab === 'all') {
        mapping.set(tab, gameState.equipment);
      } else {
        mapping.set(
          tab,
          gameState.equipment.filter(item => item.department === tab),
        );
      }
    });
    return mapping;
  }, [gameState.equipment]);

  const currentList = equipmentByTab.get(activeTab) ?? [];

  const handleScheduleMaintenance = (equipment: EquipmentItem) => {
    const result = scheduleEquipmentMaintenance(equipment.id);
    if (!result.success) {
      toast.error('Unable to schedule maintenance', {
        description: result.reason,
      });
      return;
    }

    toast.success('Maintenance scheduled', {
      description: `${equipment.name} will be serviced. Cost: $${result.cost?.toLocaleString()}`,
    });
  };

  const handleRent = () => {
    if (!selectedRentalType) return;
    const days = Math.max(1, rentalDays);
    const rentalDef = getEquipmentDefinition(selectedRentalType);
    const result = rentEquipment({ type: selectedRentalType, rentalDays: days });

    if (!result.success) {
      toast.error('Rental failed', {
        description: result.reason,
      });
      return;
    }

    toast.success('Rental confirmed', {
      description: `${rentalDef.name} secured for ${days} days. Cost: $${result.cost?.toLocaleString()}`,
    });
  };

  const renderEquipmentActions = (equipment: EquipmentItem) => {
    const needsMaintenanceSoon = differenceInCalendarDays(
      equipment.maintenanceDue,
      gameState.currentDate,
    ) <= 7;

    let helperText: string | undefined;
    if (equipment.status === 'maintenance') {
      const readyLabel = equipment.maintenanceCompleteOn
        ? format(equipment.maintenanceCompleteOn, 'MMM dd')
        : 'complete';
      helperText = `In service until ${readyLabel}`;
    } else if (needsMaintenanceSoon) {
      helperText = 'Maintenance due soon';
    }

    return (
      <EquipmentCard
        key={equipment.id}
        equipment={equipment}
        helperText={helperText}
        actionLabel="Schedule"
        onSelect={equipment.status === 'maintenance' ? undefined : () => handleScheduleMaintenance(equipment)}
        disabled={equipment.status === 'maintenance' || equipment.status === 'assigned'}
      />
    );
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="outline" onClick={() => navigate('/')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold">Equipment Inventory</h1>
              <p className="text-muted-foreground">
                Track owned gear, rentals, and maintenance windows.
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Owned Assets
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{equipmentStats.owned}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {equipmentStats.assigned} deployed • {equipmentStats.inMaintenance} in service
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Active Rentals
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{equipmentStats.rentals}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Monitor return dates to avoid penalties
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Maintenance Alerts
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${equipmentStats.dueSoon.length > 0 ? 'text-warning' : ''}`}>
                {equipmentStats.dueSoon.length}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Due within 7 days</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Today's Date
              </CardTitle>
            </CardHeader>
            <CardContent className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>{format(gameState.currentDate, 'MMMM dd, yyyy')}</span>
            </CardContent>
          </Card>
        </div>

        {equipmentStats.dueSoon.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Maintenance Priority</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {equipmentStats.dueSoon.map(item => (
                <div key={item.id} className="flex items-center justify-between border rounded p-3">
                  <div>
                    <div className="font-semibold">{item.name}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-2">
                      <Wrench className="h-3 w-3" />
                      <span>Due {format(item.maintenanceDue, 'MMM dd')}</span>
                    </div>
                  </div>
                  <Button size="sm" onClick={() => handleScheduleMaintenance(item)}>
                    Schedule
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Rent Additional Gear</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className="text-xs uppercase font-semibold text-muted-foreground">Equipment Type</label>
                <Select value={selectedRentalType} onValueChange={value => setSelectedRentalType(value as EquipmentType)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select equipment" />
                  </SelectTrigger>
                  <SelectContent>
                    {getAllEquipmentTypes().map(type => {
                      const definition = getEquipmentDefinition(type);
                      return (
                        <SelectItem key={type} value={type}>
                          {definition.name} (${definition.rentalDailyCost}/day)
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs uppercase font-semibold text-muted-foreground">Rental Days</label>
                <Input
                  type="number"
                  min={1}
                  value={rentalDays}
                  onChange={event => setRentalDays(Number(event.target.value))}
                  className="mt-1"
                />
              </div>
              <div className="flex items-end">
                <Button className="w-full" onClick={handleRent}>
                  Rent Equipment
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Inventory</CardTitle>
              <Badge variant="outline">{currentList.length} items</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={value => setActiveTab(value as (typeof departmentTabs)[number])}>
              <TabsList className="grid grid-cols-5">
                {departmentTabs.map(tab => (
                  <TabsTrigger key={tab} value={tab} className="capitalize">
                    {tab}
                  </TabsTrigger>
                ))}
              </TabsList>
              {departmentTabs.map(tab => {
                const items = equipmentByTab.get(tab) ?? [];
                return (
                  <TabsContent key={tab} value={tab} className="mt-4">
                    {items.length === 0 ? (
                      <div className="text-sm text-muted-foreground text-center py-8">
                        No equipment found for this department.
                      </div>
                    ) : (
                      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {items.map(item => renderEquipmentActions(item))}
                      </div>
                    )}
                  </TabsContent>
                );
              })}
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
